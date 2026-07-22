"""funnel：慢钱漏斗筛选器/实验（每周可证伪）。

漏斗：全市场业绩预告（预增≥50%且盈利）→ 剔除超热（60日涨幅>80%）
→ LLM 挑"政策主线 + 卖铲子位置"的 8-15 只观察篮 → 落独立台账
→ 20 个交易日后 resolve：篮子收益 vs 沪深300 → stats 输出超额(alpha)。

与 screener（连板快钱实验）成对：
- 快钱实验预注册假设：概率可校准、盈亏为负；
- 本漏斗预注册假设：篮子小幅跑赢基准（alpha 微正）。
两个实验用数据回答"该赚哪种钱"，不靠争论。

诚实边界：
- 全市场快照接口被代理拦截，估值层（PE/市值分位）本版缺席——漏斗少一层，结果偏乐观或偏噪声；
- 业绩预告是公司自报口径且全市场可见——不构成私有信息优势，篮子赚的只能是"耐心+纪律"的钱；
- 等权、收盘价成交、不含摩擦——对篮子略乐观（低换手下影响小）。
"""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

import requests

from .backends.common import safe_chat_json
from .screener import KLINE_URL, _sina_sym  # 新浪日线 helper，单一来源

# 东财业绩预告（datacenter，akshare stock_yjyg_em 底层同源），纯 requests。
YJYG_URL = "https://datacenter-web.eastmoney.com/api/data/v1/get"

# Project root is two levels up from lib/foresight/. Ledger is git-tracked
# under src/data/experiments/ so the falsifiable record survives machine
# switches — see screener.py for the same reasoning.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEDGER = os.environ.get(
    "FORESIGHT_FUNNEL_LEDGER",
    os.path.join(ROOT, "src", "data", "experiments", "funnel_experiment.jsonl"),
)
HOLD_DAYS = 20      # 持有交易日
HOT_CHG60 = 80.0    # 60日涨幅超此值视为超热剔除
BENCH = "sh000300"  # 基准：沪深300

FUNNEL_PROMPT = """你是克制的"漏斗选篮"研究员。从以下业绩预增候选中挑 6-12 只组成观察篮。
偏好：政策主线（新质生产力：AI算力/存储/半导体/机器人/高端制造/创新药等）里的**卖铲子位置**
（零部件/材料/设备/耗材/上游资源供应商）。

硬性要求：
1. 逐只回忆该公司的**主营业务**再判断，tag 必须写具体主业（如"存储模组""数控刀具"），不确定就写"不确定-仅按数据"；
2. why 必须每只不同、引用该股的具体业务或数据（预增幅度/60日位置/主业逻辑），**禁止任何两只使用相同或相近句式**；
3. 识别预增水分：极端预增幅（>1000%）多为低基数、并表、投资收益等非内生因素，在 why 里点破；
4. 敢于不选：纯概念壳、低价质地差、渠道/整机（非卖铲子）、与主线无关的周期股，直接剔除，宁缺毋滥。

候选（代码 名称 | 净利预增幅% | 60日涨幅%）：
{cands}

只返回 JSON：{{"picks": [{{"code": "600183", "tag": "卖铲子-覆铜板", "why": "该股具体逻辑，一句话"}}]}}
"""


def _period(date: str) -> str:
    """业绩预告对应的最近报告期。"""
    y, m = int(date[:4]), int(date[4:6])
    if m <= 3:
        return f"{y-1}1231"
    if m <= 6:
        return f"{y}0331"
    if m <= 9:
        return f"{y}0630"
    return f"{y}0930"


def _default_yjyg(period: str) -> list:
    """东财业绩预告，纯 requests，无需 akshare。period 形如 20260331；分页拉全，
    映射成下方 candidates() 认的中文键（预告类型/业绩变动幅度/预测数值…）。
    业绩变动幅度取增幅上下限均值；预测数值取净利下限（>0 即最坏也盈利）。"""
    rpt = f"{period[:4]}-{period[4:6]}-{period[6:]}"
    out, page = [], 1
    while page <= 6:  # 单期通常几百条，6×500 足够兜底
        j = requests.get(YJYG_URL, params={
            "sortColumns": "ADD_AMP_LOWER", "sortTypes": "-1",
            "pageSize": 500, "pageNumber": page,
            "reportName": "RPT_PUBLIC_OP_NEWPREDICT", "columns": "ALL",
            "filter": f"(REPORT_DATE='{rpt}')",
        }, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://data.eastmoney.com/"},
            timeout=15).json()
        data = ((j or {}).get("result") or {}).get("data") or []
        if not data:
            break
        for d in data:
            amps = [x for x in (d.get("ADD_AMP_LOWER"), d.get("ADD_AMP_UPPER"))
                    if isinstance(x, (int, float))]
            out.append({
                "股票代码": str(d.get("SECURITY_CODE", "")),
                "股票简称": str(d.get("SECURITY_NAME_ABBR", "")),
                "预测指标": str(d.get("PREDICT_FINANCE", "")),
                "预告类型": str(d.get("PREDICT_TYPE", "")),
                "业绩变动幅度": sum(amps) / len(amps) if amps else 0.0,
                "预测数值": d.get("PREDICT_AMT_LOWER") or 0,
            })
        if len(data) < 500:
            break
        page += 1
    return out


def _sina_hist(sym: str, start_date: str) -> list:
    """新浪日线（不复权），纯 requests。sym 为带前缀符号（sh600519/sh000300）。"""
    r = requests.get(KLINE_URL, params={"symbol": sym, "scale": 240, "ma": "no",
                     "datalen": 300}, headers={"User-Agent": "Mozilla/5.0",
                     "Referer": "https://finance.sina.com.cn"}, timeout=8)
    r.raise_for_status()
    data = json.loads(r.text)
    return [{"date": str(d["day"]).replace("-", ""), "close": float(d["close"])}
            for d in data if str(d["day"]).replace("-", "") >= start_date]


def _hist(code: str, start_date: str) -> list:
    """个股日线（新浪），无需 akshare。返回 [{date, close}]，date 为 YYYYMMDD。"""
    return _sina_hist(_sina_sym(code), start_date)


def _default_bench(start_date: str) -> list:
    """沪深300 指数日线（新浪），无需 akshare。BENCH 已是带前缀符号 sh000300。"""
    return _sina_hist(BENCH, start_date)


def _load() -> list:
    if not os.path.exists(LEDGER):
        return []
    with open(LEDGER, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def _save(entries: list):
    with open(LEDGER, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")


def candidates(period: str, yjyg_fetcher=None, min_growth: float = 50.0) -> list:
    """业绩层：净利润预增≥min_growth% 且预测为盈利；同股取净利润行去重。"""
    rows = (yjyg_fetcher or _default_yjyg)(period)
    best = {}
    for r in rows:
        code = str(r.get("股票代码", ""))
        name = str(r.get("股票简称", ""))
        ind = str(r.get("预测指标", ""))
        typ = str(r.get("预告类型", ""))
        if not code or "退" in name or "ST" in name.upper():
            continue
        if "净利润" not in ind or "扣除" in ind:
            continue
        if typ not in ("预增", "略增", "扭亏", "续盈"):
            continue
        try:
            growth = float(r.get("业绩变动幅度") or 0)
            value = float(r.get("预测数值") or 0)
        except (TypeError, ValueError):
            continue
        if growth < min_growth or value <= 0:
            continue
        if code not in best or growth > best[code]["growth"]:
            best[code] = {"code": code, "name": name, "growth": round(growth, 1)}
    return sorted(best.values(), key=lambda x: -x["growth"])


def rank(llm, date: str | None = None, top: int = 12, pre: int = 60,
         yjyg_fetcher=None, hist_fetcher=None, verbose: bool = False) -> dict:
    """跑漏斗前半段（业绩层 → 过热过滤 → LLM 选篮），返回观察篮多只
    （不落台账、不算基准）。供网页 /predict 展示，也是 scan 落账前的共用步骤。"""
    date = date or time.strftime("%Y%m%d")
    period = _period(date)
    cands = candidates(period, yjyg_fetcher=yjyg_fetcher)
    if verbose:
        print(f"  业绩层（{period} 预增≥50%且盈利）：{len(cands)} 只")

    hist = hist_fetcher or _hist
    lookback = str(int(date[:4]) - 1) + date[4:]

    def _enrich(c):
        """拉一只近一年 K 线，算多窗口涨幅（120/60/30/15/7 日）、过滤超热。
        失败/数据不足/过热返回 None。60 日仍是过热判定口径；其余窗口
        帮你看位置：长期(120)在哪、近期(7/15)是否刚启动。"""
        try:
            rows = hist(c["code"], lookback)
        except Exception:
            return None
        if len(rows) < 61:
            return None
        closes = [r["close"] for r in rows]
        chg60 = (closes[-1] / closes[-61] - 1) * 100
        if chg60 > HOT_CHG60:
            return None  # 超热剔除：不追已爆炒
        c = dict(c)
        c["entry_price"] = closes[-1]
        c["chg60"] = round(chg60, 1)
        for n in (120, 30, 15, 7):
            c[f"chg{n}"] = (round((closes[-1] / closes[-n - 1] - 1) * 100, 1)
                            if len(closes) > n else None)
        return c

    # 并发拉 K 线：串行经代理会拖到 40s+ 超时，并发压到几秒。
    # ex.map 保序 → 保持按预增幅度降序。max_workers 不宜过大，避免新浪限流。
    with ThreadPoolExecutor(max_workers=10) as ex:
        enriched = [c for c in ex.map(_enrich, cands[:pre]) if c]
    if verbose:
        print(f"  过热过滤（60日涨幅≤{HOT_CHG60:.0f}%）：{len(enriched)} 只")
    if not enriched:
        return {"date": date, "period": period, "stocks": []}

    cands_text = "\n".join(
        f'{c["code"]} {c["name"]} | 预增{c["growth"]}% | '
        f'120日{c.get("chg120")}% 60日{c["chg60"]}% 30日{c.get("chg30")}% 7日{c.get("chg7")}%'
        for c in enriched)
    data, err = safe_chat_json(llm, FUNNEL_PROMPT.format(cands=cands_text), temperature=0.3)
    picked = {}
    if not err and isinstance(data, dict) and isinstance(data.get("picks"), list):
        picked = {str(p.get("code")): p for p in data["picks"] if isinstance(p, dict)}
    basket = [c for c in enriched if c["code"] in picked][:top]
    if not basket:  # LLM 不可用/全不匹配 → 退回按增速取前 N（优雅降级）
        basket = enriched[:top]
        for c in basket:
            c["tag"], c["why"] = "增速兜底", "LLM不可用，按预增幅度直取"
    else:
        for c in basket:
            c["tag"] = str(picked[c["code"]].get("tag", ""))[:30]
            c["why"] = str(picked[c["code"]].get("why", ""))[:80]

    stocks = [{"code": c["code"], "name": c["name"], "growth": c["growth"],
               "chg120": c.get("chg120"), "chg60": c["chg60"], "chg30": c.get("chg30"),
               "chg15": c.get("chg15"), "chg7": c.get("chg7"),
               "tag": c.get("tag", ""), "why": c.get("why", ""),
               "entry_price": c["entry_price"]} for c in basket]
    return {"date": date, "period": period, "stocks": stocks}


def latest_batch() -> dict:
    """台账里最近一批观察篮（可能已判定）。供网页实时抓取失败时降级展示。"""
    entries = _load()
    if not entries:
        return {"date": None, "period": None, "stocks": [], "stale": True}
    last = max(e["batch"] for e in entries)
    rows = [e for e in entries if e["batch"] == last]
    rows.sort(key=lambda e: -(e.get("growth") or 0))
    stocks = [{
        "code": e["code"], "name": e["name"], "growth": e.get("growth"),
        "chg120": e.get("chg120"), "chg60": e.get("chg60"), "chg30": e.get("chg30"),
        "chg15": e.get("chg15"), "chg7": e.get("chg7"),
        "tag": e.get("tag", ""), "why": e.get("why", ""),
        "entry_price": e.get("entry_price"), "ret": e.get("ret"), "alpha": e.get("alpha"),
    } for e in rows]
    return {"date": last, "period": _period(last), "stocks": stocks, "stale": True}


def scan(llm, date: str | None = None, top: int = 12, pre: int = 60,
         yjyg_fetcher=None, hist_fetcher=None, bench_fetcher=None, verbose=True) -> list:
    """跑一次完整漏斗并落账（同批次同股去重）。复用 rank，再补基准入场价后落账。"""
    r = rank(llm, date=date, top=top, pre=pre, yjyg_fetcher=yjyg_fetcher,
             hist_fetcher=hist_fetcher, verbose=verbose)
    date = r["date"]
    if not r["stocks"]:
        return []

    lookback = str(int(date[:4]) - 1) + date[4:]
    try:
        bench_rows = (bench_fetcher or _default_bench)(lookback)
        bench_entry = bench_rows[-1]["close"] if bench_rows else None
    except Exception:
        bench_entry = None

    entries = _load()
    seen = {(e["batch"], e["code"]) for e in entries}
    added = []
    for c in r["stocks"]:
        if (date, c["code"]) in seen:
            continue
        e = {"id": f'{date}-{c["code"]}', "batch": date, "code": c["code"], "name": c["name"],
             "growth": c["growth"], "chg120": c.get("chg120"), "chg60": c["chg60"],
             "chg30": c.get("chg30"), "chg15": c.get("chg15"), "chg7": c.get("chg7"),
             "tag": c["tag"], "why": c["why"],
             "entry_price": c["entry_price"], "bench_entry": bench_entry, "hold_days": HOLD_DAYS,
             "exit_price": None, "bench_exit": None, "ret": None, "bench_ret": None,
             "alpha": None, "resolved_ts": None}
        entries.append(e)
        added.append(e)
        if verbose:
            print(f'  ✓ {c["name"]}({c["code"]}) 预增{c["growth"]}% 60日{c["chg60"]}%｜{c["tag"]}｜{c["why"]}')
    _save(entries)
    if verbose:
        print(f"本批入篮 {len(added)} 只（台账共 {len(entries)} 条）→ {LEDGER}")
    return added


def resolve_pending(hist_fetcher=None, bench_fetcher=None, verbose=True) -> int:
    """对每条满 hold_days 个交易日的持仓：算篮子收益、基准收益、超额。"""
    hist = hist_fetcher or _hist
    bench = bench_fetcher or _default_bench
    entries = _load()
    bench_cache = {}
    n = 0
    for e in entries:
        if e["alpha"] is not None:
            continue
        try:
            rows = [r for r in hist(e["code"], e["batch"]) if r["date"] > e["batch"]]
        except Exception as ex:
            if verbose:
                print(f'  ! {e["name"]} 行情失败（{type(ex).__name__}），下次再试')
            continue
        if len(rows) < e["hold_days"]:
            continue  # 还没满持有期
        exit_close = rows[e["hold_days"] - 1]["close"]
        if e["batch"] not in bench_cache:
            try:
                bench_cache[e["batch"]] = [r for r in bench(e["batch"]) if r["date"] > e["batch"]]
            except Exception:
                bench_cache[e["batch"]] = []
        brows = bench_cache[e["batch"]]
        e["exit_price"] = exit_close
        e["ret"] = round(exit_close / e["entry_price"] - 1, 4) if e["entry_price"] else None
        if e["bench_entry"] and len(brows) >= e["hold_days"]:
            e["bench_exit"] = brows[e["hold_days"] - 1]["close"]
            e["bench_ret"] = round(e["bench_exit"] / e["bench_entry"] - 1, 4)
            e["alpha"] = round(e["ret"] - e["bench_ret"], 4) if e["ret"] is not None else None
        else:
            e["alpha"] = e["ret"]  # 无基准时退化为绝对收益，诚实标注
        e["resolved_ts"] = time.strftime("%Y-%m-%d %H:%M")
        n += 1
        if verbose and e["ret"] is not None:
            print(f'  {"跑赢✓" if (e["alpha"] or 0) > 0 else "跑输✗"} {e["name"]} '
                  f'收益{e["ret"]:+.1%} vs 基准{(e["bench_ret"] if e["bench_ret"] is not None else 0):+.1%} '
                  f'→ alpha {e["alpha"]:+.1%}')
    _save(entries)
    if verbose:
        print(f"本次判定 {n} 条")
    return n


def stats() -> dict:
    entries = _load()
    done = [e for e in entries if e["alpha"] is not None and e["ret"] is not None]
    if not done:
        return {"total": len(entries), "resolved": 0,
                "note": "尚无到期持仓；scan 后等满 20 个交易日跑 resolve"}
    alphas = [e["alpha"] for e in done]
    rets = [e["ret"] for e in done]
    return {
        "total": len(entries), "resolved": len(done),
        "avg_ret": round(sum(rets) / len(rets), 4),
        "avg_bench_ret": round(sum(e["bench_ret"] for e in done if e["bench_ret"] is not None)
                               / max(1, sum(1 for e in done if e["bench_ret"] is not None)), 4),
        "avg_alpha": round(sum(alphas) / len(alphas), 4),
        "beat_rate": round(sum(1 for a in alphas if a > 0) / len(alphas), 3),
        "note": "等权/收盘成交/无摩擦的乐观近似；预注册假设：alpha 微正。数据说话。",
    }
