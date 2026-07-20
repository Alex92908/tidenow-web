"""zt：连板接力筛选器/实验（每日可证伪）。

流程：扫当日涨停池（东财，二板及以上）→ 基率+LLM微调 给"明日晋级(再涨停)概率"
→ 落独立台账 zt_experiment.jsonl → 次日 resolve（收盘口径）→ stats 输出 Brier + 虚拟盈亏。

设计立场（对应"预测 vs 优势"之辩）：
- 概率可校准 ≠ 有可赚的优势。本实验同时输出两个数：校准分(Brier) 与 虚拟盈亏(含摩擦成本)。
  预注册假设：Brier 尚可、盈亏为负——用数据而非争论回答"能否靠接力赚钱"。
- 台账与主校准库(predictions.jsonl)隔离：高频实验不得淹没真实预测记录。

诚实边界：
- 晋级判定用次日收盘涨幅≈涨停阈值（收盘口径），盘中触板回落不算——略低估晋级率；
- 虚拟买入价=当日涨停价（现实中排板未必成交），卖出=次日收盘，摩擦成本 0.3%——
  这是对散户可得执行的乐观近似，真实结果只会更差。
"""
from __future__ import annotations

import json
import os
import time

import requests

from .backends.common import safe_chat_json, to_prob

# 东财涨停池（akshare 底层就是打这个接口，纯 HTTP，无需 akshare 那坨 pandas）。
ZT_POOL_URL = "https://push2ex.eastmoney.com/getTopicZTPool"
# 新浪日线（不复权），纯 requests。resolve 用它拿次日收盘判晋级。
KLINE_URL = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"

# In TideNow this package lives at <project>/lib/foresight/, so the project
# root is two levels up. The ledger is git-tracked under src/data/experiments/
# — the experiment's whole point is accumulating a falsifiable record, so it
# must survive machine switches and (unlike /tmp) cold starts.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEDGER = os.environ.get(
    "FORESIGHT_ZT_LEDGER",
    os.path.join(ROOT, "src", "data", "experiments", "zt_experiment.jsonl"),
)

# 连板高度 → 次日晋级基率（打板圈公开统计的大致区间，可随实验数据自校正）
BASE_RATE = {2: 0.30, 3: 0.35, 4: 0.38, 5: 0.40}
FEE = 0.003  # 手续费+滑点（乐观）

ZT_PROMPT = """你是克制的打板接力评估员。基于以下涨停股特征，对"明日继续涨停"的基率做微调。
只考虑给到的信息，不臆测。调整范围严格限制在 -0.10 到 +0.10 之间。

股票：{name}（{code}）｜连板数：{height}｜基率：{base:.0%}
行业：{industry}｜封板资金：{seal}｜流通市值：{mcap}｜炸板次数：{break_n}｜首次封板：{first_time}

参考逻辑：封板资金/流通市值高→加分；炸板多→减分；封板早→加分；题材是否当下主线自行判断。

只返回 JSON：{{"adjust": 0.05, "reason": "一句话理由"}}
"""


def _limit_threshold(code: str) -> float:
    """按代码推断涨停幅度：创业板/科创板20%，北交所30%，主板10%。"""
    if code.startswith(("30", "68")):
        return 0.20
    if code.startswith(("8", "4", "92")):
        return 0.30
    return 0.10


def _fetch_zt_pool_em(date: str) -> list:
    """东财涨停池，纯 HTTP。返回 push2ex 原始行（字段 c/n/lbc/p/fund/zbc/hybk/…）。"""
    r = requests.get(ZT_POOL_URL, params={
        "ut": "7eea3edcaed734bea9cbfc24409ed989", "dpt": "wz.ztzt",
        "Pageindex": 0, "pagesize": 100, "sort": "fbt:asc", "date": date,
    }, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
    r.raise_for_status()
    return (r.json().get("data") or {}).get("pool") or []


def fetch_zt_pool(date: str, fetcher=None) -> list:
    """抓当日涨停池（东财 push2ex，纯 requests，无需 akshare），返回二板及以上候选。
    fetcher 可注入（测试用），需返回 push2ex 原始行（字段 c/n/lbc/p/fund/…）。"""
    rows = (fetcher or _fetch_zt_pool_em)(date)
    out = []
    for r in rows:
        name = str(r.get("n", ""))
        if "退" in name or "ST" in name.upper():
            continue
        height = int(r.get("lbc", 1) or 1)  # 连板数
        if height < 2:
            continue
        out.append({
            "code": str(r.get("c", "")), "name": name, "height": height,
            "price": round(float(r.get("p", 0) or 0) / 1000, 2),  # push2ex 价为厘
            "industry": str(r.get("hybk", "")),
            "seal": float(r.get("fund", 0) or 0),   # 封板资金
            "mcap": float(r.get("ltsz", 0) or 0),   # 流通市值
            "break_n": int(r.get("zbc", 0) or 0),   # 炸板次数
            "first_time": str(r.get("fbt", "")).zfill(6),  # 首次封板 HHMMSS
        })
    return out


def score(llm, stock: dict) -> dict:
    """基率 + LLM 微调（±0.10 硬夹）。LLM 失败则退回纯基率——优雅降级。"""
    base = BASE_RATE.get(min(stock["height"], 5), 0.40)
    data, err = safe_chat_json(llm, ZT_PROMPT.format(
        name=stock["name"], code=stock["code"], height=stock["height"], base=base,
        industry=stock["industry"], seal=f'{stock["seal"]/1e8:.1f}亿' if stock["seal"] else "?",
        mcap=f'{stock["mcap"]/1e8:.0f}亿' if stock["mcap"] else "?",
        break_n=stock["break_n"], first_time=stock["first_time"]), temperature=0.2)
    if err or not isinstance(data, dict):
        return {"prob": base, "reason": f"LLM不可用，纯基率（{err or '格式异常'}）"}
    adj = max(-0.10, min(0.10, to_prob(data.get("adjust"), 0.5) - 0.5 if isinstance(data.get("adjust"), str)
                          else float(data.get("adjust") or 0)))
    return {"prob": round(min(max(base + adj, 0.02), 0.95), 3), "reason": str(data.get("reason", ""))[:80]}


def _load() -> list:
    if not os.path.exists(LEDGER):
        return []
    with open(LEDGER, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def _save(entries: list):
    with open(LEDGER, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")


def rank(llm, date: str | None = None, top: int = 10, fetcher=None) -> dict:
    """扫涨停池 + 打分，返回排好序的多只候选（不落台账）。
    供网页 /predict 直接展示"今日热门多只"，也是 scan 落账前的共用步骤。"""
    date = date or time.strftime("%Y%m%d")
    pool = fetch_zt_pool(date, fetcher=fetcher)
    pool.sort(key=lambda s: (-s["height"], -(s["seal"] / s["mcap"] if s["mcap"] else 0)))
    stocks = []
    for s in pool[:top]:
        sc = score(llm, s)
        stocks.append({
            "code": s["code"], "name": s["name"], "height": s["height"],
            "price": s["price"], "industry": s["industry"], "break_n": s["break_n"],
            "threshold": _limit_threshold(s["code"]),
            "prob": sc["prob"], "reason": sc["reason"],
        })
    return {"date": date, "stocks": stocks}


def latest_batch() -> dict:
    """台账里最近一个交易日那批（已打分，可能已判定）。
    供网页在实时抓取失败（如 Vercel 海外 IP 被墙）时降级展示，永远有内容。"""
    entries = _load()
    if not entries:
        return {"date": None, "stocks": [], "stale": True}
    last = max(e["date"] for e in entries)
    rows = [e for e in entries if e["date"] == last]
    rows.sort(key=lambda e: (-e.get("height", 0), -(e.get("prob", 0) or 0)))
    stocks = [{
        "code": e["code"], "name": e["name"], "height": e.get("height", 0),
        "price": e.get("buy_price"), "industry": "", "break_n": None,
        "prob": e.get("prob"), "reason": e.get("reason", ""),
        "outcome": e.get("outcome"), "ret": e.get("ret"),
    } for e in rows]
    return {"date": last, "stocks": stocks, "stale": True}


def scan(llm, date: str | None = None, top: int = 10, fetcher=None, verbose=True) -> list:
    """扫描并落账。同日同股去重。复用 rank 的抓取+打分，避免两处逻辑漂移。"""
    r = rank(llm, date=date, top=top, fetcher=fetcher)
    date = r["date"]
    entries = _load()
    seen = {(e["date"], e["code"]) for e in entries}
    added = []
    for s in r["stocks"]:
        if (date, s["code"]) in seen:
            continue
        e = {"id": f'{date}-{s["code"]}', "date": date, "code": s["code"], "name": s["name"],
             "height": s["height"], "buy_price": s["price"], "threshold": s["threshold"],
             "prob": s["prob"], "reason": s["reason"],
             "outcome": None, "next_close": None, "ret": None, "resolved_ts": None}
        entries.append(e)
        added.append(e)
        if verbose:
            print(f'  ✓ {s["name"]}({s["code"]}) {s["height"]}板 → 晋级概率 {s["prob"]:.0%}｜{s["reason"]}')
    _save(entries)
    if verbose:
        print(f"本次入账 {len(added)} 只（台账共 {len(entries)} 条）→ {LEDGER}")
    return added


def _sina_sym(code: str) -> str:
    """A 股代码 → 新浪前缀符号：6/9→sh，0/3→sz，其余（北交所）→bj。"""
    if code[:1] in ("6", "9"):
        return "sh" + code
    if code[:1] in ("0", "3"):
        return "sz" + code
    return "bj" + code


def _default_hist(code: str, start_date: str) -> list:
    """新浪日线（不复权，与涨停价同口径），纯 requests，无需 akshare。
    返回 [{date, close, pct}]；pct 由相邻收盘价推算（新浪该接口不直接给涨跌幅）。"""
    r = requests.get(KLINE_URL, params={"symbol": _sina_sym(code), "scale": 240,
                     "ma": "no", "datalen": 260},
                     headers={"User-Agent": "Mozilla/5.0",
                              "Referer": "https://finance.sina.com.cn"}, timeout=12)
    r.raise_for_status()
    data = json.loads(r.text)
    out, prev = [], None
    for d in data:
        day = str(d["day"]).replace("-", "")
        close = float(d["close"])
        pct = (close / prev - 1) * 100 if prev else 0.0
        prev = close
        if day >= start_date:
            out.append({"date": day, "close": close, "pct": round(pct, 2)})
    return out


def resolve_pending(hist_fetcher=None, verbose=True) -> int:
    """判定所有已过期未判定条目：取入账日后的第一个交易日，收盘口径判晋级、记收益。"""
    fetch = hist_fetcher or _default_hist
    entries = _load()
    n = 0
    for e in entries:
        if e["outcome"] is not None:
            continue
        try:
            rows = [r for r in fetch(e["code"], e["date"]) if r["date"] > e["date"]]
        except Exception as ex:
            if verbose:
                print(f'  ! {e["name"]} 行情拉取失败（{type(ex).__name__}），下次再试')
            continue
        if not rows:
            continue  # 次日还没收盘
        nxt = rows[0]
        e["outcome"] = 1 if nxt["pct"] >= e["threshold"] * 100 * 0.98 else 0
        e["next_close"] = nxt["close"]
        e["ret"] = round(nxt["close"] / e["buy_price"] - 1 - FEE, 4) if e["buy_price"] else None
        e["resolved_ts"] = time.strftime("%Y-%m-%d %H:%M")
        n += 1
        if verbose:
            tag = "晋级✓" if e["outcome"] else "断板✗"
            print(f'  {tag} {e["name"]}({e["date"]}入) p={e["prob"]:.0%} 实盈 {e["ret"]:+.1%}')
    _save(entries)
    if verbose:
        print(f"本次判定 {n} 条")
    return n


def stats() -> dict:
    """实验统计：校准(Brier) 与 虚拟盈亏 分开呈现——概率准不准、钱赚不赚是两个问题。"""
    entries = _load()
    done = [e for e in entries if e["outcome"] is not None]
    if not done:
        return {"total": len(entries), "resolved": 0,
                "note": "尚无已判定条目；scan 次日跑 resolve"}
    brier = sum((e["prob"] - e["outcome"]) ** 2 for e in done) / len(done)
    rets = [e["ret"] for e in done if e["ret"] is not None]
    wins = [r for r in rets if r > 0]
    return {
        "total": len(entries), "resolved": len(done),
        "hit_rate": round(sum(e["outcome"] for e in done) / len(done), 3),
        "avg_prob": round(sum(e["prob"] for e in done) / len(done), 3),
        "brier": round(brier, 4),
        "brier_note": "瞎猜=0.25，越低越准（校准维度）",
        "virtual_pnl_sum": round(sum(rets), 4) if rets else None,
        "virtual_pnl_avg": round(sum(rets) / len(rets), 4) if rets else None,
        "win_rate": round(len(wins) / len(rets), 3) if rets else None,
        "pnl_note": "含0.3%摩擦的乐观近似（排板必成交假设）；真实执行只会更差",
    }
