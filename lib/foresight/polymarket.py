"""polymarket：预测市场纸面盲估对照实验（可判定、只读、不下单）。

流程：Gamma 公开 API 拉活跃二元市场（按 24h 成交量）→ 硬过滤（流动性/临近到期/
价格带/未开赛）→ 纪律拒测（短期天气/纯价格阈值/纯随机）→ LLM **盲估**概率
（不看盘价，可注入联网搜索上下文）→ 落独立台账 poly_experiment.jsonl
→ 到期 resolve（UMA 结算口径）→ stats 输出双 Brier（模型 vs 市场价）+ 纸面凯利盈亏。

结构（与 tidenow-web 分叉的同名模块保持镜像，便于双向搬运）：
  - rank()：抓取+盲估、**不落台账**——GUI「扫盲估」按钮与 web /predict 页用它展示；
  - latest_batch()：抓取失败时降级读台账最近一批；
  - scan()/resolve_pending()/stats()：CLI 台账闭环（main.py poly ...）。

预注册假设（对应"给Grok 50美元赚到5273"病毒帖的对照实验）：
- 模型盲估 Brier **差于**市场价格自身的 Brier（盘价已聚合公共信息与真金投票）；
- 按 |盲估-盘价|≥8% 触发、6% 凯利上限的纸面策略，盈亏 ≈ 0 或为负。
若数据推翻假设，那才是发现；不靠叙事，靠台账。

诚实边界（不许删）：
- 盲估设计：LLM 全程看不到盘价，实验测的是"模型 vs 市场"，不是"模型+抄市场"；
- 纸面成交按扫描时盘价快照，不含点差/滑点/费用（Polymarket 部分市场有 taker fee）、
  不含流动性冲击——纸面盈亏是**乐观上界**；
- 拒测线与全系统纪律一致：短期天气是数值预报的领域（nature 纪律）、无量化信号
  不做纯 LLM 价格判断（market 纪律）、纯随机拒测（randomness 纪律）。
  病毒帖声称的"天气盘暴富"，在本系统里正是被拒测的那一类；
- 本模块只读公开行情、只写本地台账，不含任何钱包/下单能力；输出不构成投注建议。

定时（自动化通道）：crontab 例：
  0 9,15,21 * * *  cd /path/to/foresight && python3 main.py poly scan --top 10 --push
  30 8 * * *       cd /path/to/foresight && python3 main.py poly resolve
"""
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone

import requests

from .backends.common import safe_chat_json, to_prob

# Ledger is git-tracked under src/data/experiments/ (project root is two
# levels up from lib/foresight/) — the experiment's whole point is an
# accumulating falsifiable record, same reasoning as screener.py.
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEDGER = os.environ.get(
    "FORESIGHT_POLY_LEDGER",
    os.path.join(ROOT, "src", "data", "experiments", "polymarket_experiment.jsonl"),
)
GAMMA_BASE = os.environ.get("FORESIGHT_POLY_BASE", "https://gamma-api.polymarket.com")

MIN_LIQ = 10_000.0        # 流动性下限（美元）：太薄的盘价格本身没有信息量
MAX_DAYS = 45             # 只做 45 天内到期：实验要能在项目生命周期内闭环
PRICE_BAND = (0.03, 0.97)  # 极端价盘剔除：多为已定局事件，纸面成交也不现实
EDGE_MIN = 0.08           # 触发纸面下注的最小偏差（对照病毒帖的 8%）
KELLY_CAP = 0.06          # 单笔凯利上限（对照病毒帖的 6%）
BANKROLL = 100.0          # 虚拟本金（单位），不复利：每笔独立按比例下注
# 同一相关簇（同场比赛 / 同一问题的不同期限 / 同一事件）的纸面总敞口上限。
# 首批实测教训：霍尔木兹主题一次触发 3 笔各 6%，实际是同一件事上押了 18%——
# 凯利的独立性假设在预测市场里几乎从不成立，必须按簇限额。
CLUSTER_CAP = 0.10

# 纪律拒测（代码层硬规则，LLM 层再兜一道）：关键词 → 拒测理由
REFUSE_RULES = [
    (("temperature", "°f", "°c", "heat index", "rain in", "snow in", "weather",
      "high temp", "low temp"),
     "短期天气：数值预报领域，纪律拒测（nature）"),
    (("bitcoin", "btc", "ethereum", "solana", "xrp", "dogecoin", "crypto",
      "all-time high", "price of", "close above", "close below", "reach $",
      "hit $", "up or down", "s&p", "nasdaq", "gold price"),
     "价格阈值盘：无量化信号不做纯LLM价格判断（market）"),
    (("lottery", "powerball", "dice", "roulette"),
     "纯随机事件：拒绝预测（randomness）"),
]

POLY_PROMPT = """你是克制的预测市场盲估研究员。对下面这个二元市场，在**不知道市场价格**的
前提下给出你的概率估计。这是校准实验：诚实的不确定比伪装的自信值钱。

市场问题：{question}
结果A：{outcome_a}　结果B：{outcome_b}
结算截止：{end_date}（今天是 {today}）
规则摘要：{description}
{structure}{context}

要求：
1. domain 从中选一个：sports|election|scenario|macro|trend|boxoffice|nature|opinion|other
2. 以下情况把 eligible 设为 false 并给 refuse_reason：短期天气/气温类；具体资产价格阈值类；
   纯随机类；或结果几乎完全取决于你没有的盘中实时信息
3. eligible 为 true 时，给出"结果A"发生的概率 probability（0-1）
4. **信息不足时说不知道，而不是回退到 50%**：50% 是"两边等可能"这个强主张，
   不是"我不了解"的安全答案。若你对该事件的近况一无所知（尤其是快速演变的地缘/赛事），
   把 eligible 设为 false、refuse_reason 写明缺什么信息——弃权不扣分，乱猜会。
5. 有把握时就给出有把握的数：基率清楚、局势明朗的事件本来就该落在 5% 或 95% 附近。
   刻意往 50% 收敛不是克制，是另一种系统性偏差。
6. reason 一句话：你依据的主要基率/证据

只返回 JSON：
{{"eligible": true, "domain": "...", "probability": 0.5, "reason": "...", "refuse_reason": null}}
"""


# ---------- Gamma API ----------

def _f(v, default=0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _parse_end(m: dict):
    """endDate → aware datetime（UTC）；解析失败返回 None（该市场跳过）。"""
    raw = m.get("endDate") or ""
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    try:
        d = datetime.strptime(m.get("endDateIso") or "", "%Y-%m-%d")
        return d.replace(hour=23, minute=59, tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_market(m: dict):
    """Gamma 原始 dict → 标准化候选；不合格返回 (None, 原因)。"""
    try:
        outcomes = json.loads(m.get("outcomes") or "[]")
        prices = [_f(p) for p in json.loads(m.get("outcomePrices") or "[]")]
    except (json.JSONDecodeError, TypeError):
        return None, "字段解析失败"
    if len(outcomes) != 2 or len(prices) != 2:
        return None, "非二元市场"
    end = _parse_end(m)
    if end is None:
        return None, "到期时间缺失"
    now = datetime.now(timezone.utc)
    days = (end - now).total_seconds() / 86400
    if days <= 0 or days > MAX_DAYS:
        return None, f"到期不在窗口内（{days:.0f}天）"
    liq = _f(m.get("liquidityNum") or m.get("liquidity"))
    if liq < MIN_LIQ:
        return None, f"流动性不足（{liq:.0f}）"
    if not (PRICE_BAND[0] <= prices[0] <= PRICE_BAND[1]):
        return None, f"价格越出可交易带（{prices[0]}）"
    gs = str(m.get("gameStartTime") or "")
    if gs:
        try:
            start = datetime.strptime(gs[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            if start <= now:
                return None, "赛事已开始（盘中信息不对称，赛前锚定无意义）"
        except ValueError:
            pass
    ev = (m.get("events") or [{}])[0] if isinstance(m.get("events"), list) else {}
    return {
        "mkt_id": str(m.get("id", "")),
        "question": str(m.get("question", ""))[:200],
        "slug": str(m.get("slug", "")),
        "event_id": str(ev.get("id", "")) or "",
        "event_title": str(ev.get("title", ""))[:120],
        "outcome_a": str(outcomes[0])[:60],
        "outcome_b": str(outcomes[1])[:60],
        "p_market": round(prices[0], 4),
        "liquidity": round(liq, 0),
        "end_date": end.strftime("%Y-%m-%d"),
        "description": str(m.get("description", ""))[:600],
    }, None


def refuse_reason(question: str):
    q = " " + (question or "").lower() + " "
    for keys, reason in REFUSE_RULES:
        if any(k in q for k in keys):
            return reason
    return None


# ---------- 结构识别：阶梯 / 互斥兄弟 ----------
# 首批实测暴露的两个硬伤，都源于"逐个市场独立盲估、没有任何跨市场约束"：
#   1. 同一场球的两个盘各估各的 → 巴萨65% + 毕尔巴鄂40% = 105%，平局还没算；
#   2. 同一问题的不同期限各估各的 → 对 9/30 给 65%，而市场对 12/31 才给 34%。
# 修法不是给模型看盘价（那会毁掉盲估设计），而是告诉它**结构**：
# 有哪些兄弟盘、约束是什么。价格一个字都不漏。

_MONTHS = ("January|February|March|April|May|June|July|August|September|October|"
           "November|December")
# "by August 31" / "through September 15, 2026" / "on 2026-08-27"
# 注意只吃 1-2 位日号：否则 "after the September 2026 meeting" 会被误判成日期后缀。
_DATE_RE = re.compile(
    rf"\b(by|before|through|until|on)\s+(?:(?:{_MONTHS})\s+\d{{1,2}}(?:,\s*\d{{4}})?"
    rf"|\d{{4}}-\d{{2}}-\d{{2}})",
    re.IGNORECASE)


def ladder_stem(question: str) -> str:
    """抹掉截止日期后缀 → 同一问题不同期限的共同词干。无日期后缀返回 ""。"""
    q = question or ""
    if not _DATE_RE.search(q):
        return ""
    stem = _DATE_RE.sub(" <DATE> ", q)
    return re.sub(r"\s+", " ", stem).strip().rstrip("?").strip().lower()


def ladder_direction(question: str) -> str:
    """by/before → 累计型，期限越晚概率越高；through/until → 存活型，越晚越低。"""
    m = _DATE_RE.search(question or "")
    if not m:
        return "unknown"
    return "down" if m.group(1).lower() in ("through", "until") else "up"


def build_structure(cands: list) -> list:
    """给每个候选标注 cluster（相关簇）与 structure（喂给 prompt 的结构提示，不含价格）。

    阶梯优先于互斥：停火那组 event id 相同但其实是嵌套阶梯（96%/90%），
    按"互斥概率和≤1"去查它会得出错误结论。"""
    ladders, siblings = {}, {}
    for c in cands:
        c["stem"] = ladder_stem(c["question"])
        if c["stem"]:
            ladders.setdefault(c["stem"], []).append(c)
        if c.get("event_id"):
            siblings.setdefault(c["event_id"], []).append(c)

    for c in cands:
        peers_l = [x for x in ladders.get(c["stem"], [])
                   if x["mkt_id"] != c["mkt_id"] and x["end_date"] != c["end_date"]]
        # 同词干同期限的不算阶梯；跨 event 的阶梯（霍尔木兹）也能抓到
        if peers_l:
            c["cluster"] = "ladder:" + c["stem"][:60]
            c["group_kind"] = "ladder"
            dirn = ladder_direction(c["question"])
            dates = sorted({x["end_date"] for x in peers_l} | {c["end_date"]})
            rule = {"up": "截止日越晚，概率必须越高（累计型：早发生也算晚发生）",
                    "down": "截止日越晚，概率必须越低（存活型：撑得久必然撑过短期）"}.get(
                dirn, "不同期限之间必须单调，不能自相矛盾")
            c["structure"] = (
                f"\n【结构提示（不含任何价格）】同一问题还有其它截止日的版本：{('、'.join(dates))}。\n"
                f"约束：{rule}。请让你对本期限（{c['end_date']}）的估计与该约束自洽——"
                f"例如若你认为长期限也难发生，短期限只会更难。\n")
            continue
        peers_s = [x for x in siblings.get(c.get("event_id"), [])
                   if x["mkt_id"] != c["mkt_id"]]
        if peers_s:
            c["cluster"] = "event:" + str(c.get("event_id"))
            c["group_kind"] = "sibling"
            names = "；".join(x["question"][:70] for x in peers_s[:4])
            c["structure"] = (
                f"\n【结构提示（不含任何价格）】同一事件下还有互斥选项：{names}。\n"
                f"约束：这些互斥结果的概率之和不能超过 100%（若还存在平局/其它结果，"
                f"总和还要更低）。别把每个选项当成孤立问题各给一个数。\n")
            continue
        c["cluster"] = "solo:" + c["mkt_id"]
        c["group_kind"] = "solo"
        c["structure"] = ""
    return cands


def coherence_report(rows: list) -> dict:
    """跨市场一致性检查——**不需要等结算就能算**，是立刻可得的质量信号。

    同时对市场价跑同一套检查作为对照：市场基本不会违反，模型违反多少即差距。"""
    out = {"sibling_groups": 0, "sibling_violations": 0, "sibling_worst": None,
           "ladder_groups": 0, "ladder_violations": 0, "ladder_worst": None,
           "market_violations": 0}
    groups = {}
    for r in rows:
        groups.setdefault(r.get("cluster", ""), []).append(r)

    for key, g in groups.items():
        if len(g) < 2:
            continue
        if key.startswith("event:"):
            out["sibling_groups"] += 1
            for who, field in (("model", "p_model"), ("market", "p_market")):
                total = sum(x[field] for x in g)
                if total > 1.0 + 1e-9:
                    if who == "model":
                        out["sibling_violations"] += 1
                        cur = out["sibling_worst"]
                        if cur is None or total > cur["sum"]:
                            out["sibling_worst"] = {
                                "sum": round(total, 3),
                                "markets": [x["name"][:48] for x in g],
                                "probs": [x["p_model"] for x in g]}
                    else:
                        out["market_violations"] += 1
        elif key.startswith("ladder:"):
            out["ladder_groups"] += 1
            ordered = sorted(g, key=lambda x: x.get("end_date", ""))
            dirn = ladder_direction(ordered[0].get("name", ""))
            for who, field in (("model", "p_model"), ("market", "p_market")):
                seq = [x[field] for x in ordered]
                bad = (any(b < a - 1e-9 for a, b in zip(seq, seq[1:])) if dirn == "up"
                       else any(b > a + 1e-9 for a, b in zip(seq, seq[1:])) if dirn == "down"
                       else not (seq == sorted(seq) or seq == sorted(seq, reverse=True)))
                if bad:
                    if who == "model":
                        out["ladder_violations"] += 1
                        if out["ladder_worst"] is None:
                            out["ladder_worst"] = {
                                "dates": [x.get("end_date") for x in ordered],
                                "probs": seq,
                                "markets": [x["name"][:48] for x in ordered]}
                    else:
                        out["market_violations"] += 1
    return out


def sharpness(rows: list) -> dict:
    """锐度对比：mean|p-0.5|。模型显著低于市场 = 系统性欠自信（往 50% 收敛）。

    首批实测：9 行里 8 行模型比市场更靠近 50%，且所有触发的纸面单都落在极端价盘上——
    那不是 edge，是欠自信被当成了信号。这个指标把它变成一个可以盯的数。"""
    if not rows:
        return {}
    sm = sum(abs(r["p_model"] - 0.5) for r in rows) / len(rows)
    sp = sum(abs(r["p_market"] - 0.5) for r in rows) / len(rows)
    pulled = sum(1 for r in rows if abs(r["p_model"] - 0.5) < abs(r["p_market"] - 0.5))
    out = {"model_sharpness": round(sm, 4), "market_sharpness": round(sp, 4),
           "sharpness_ratio": round(sm / sp, 3) if sp else None,
           "pulled_to_half": f"{pulled}/{len(rows)}"}
    if out["sharpness_ratio"] is not None and out["sharpness_ratio"] < 0.8:
        out["warning"] = ("模型系统性欠自信（锐度不足市场八成）——此时所有'偏差'都可能是"
                          "往50%收敛的产物，而非真实错价")
    return out


def fetch_markets(limit: int = 100, fetcher=None) -> list:
    """拉活跃市场原始列表（按24h成交量降序）。fetcher 可注入（测试用）。"""
    if fetcher:
        return fetcher(limit)
    resp = requests.get(f"{GAMMA_BASE}/markets",
                        params={"closed": "false", "active": "true", "limit": limit,
                                "order": "volume24hr", "ascending": "false"},
                        headers={"User-Agent": "foresight-poly/0.1"}, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def fetch_market(mkt_id: str, fetcher=None) -> dict:
    """按 id 拉单个市场（resolve 用）。"""
    if fetcher:
        return fetcher(mkt_id)
    resp = requests.get(f"{GAMMA_BASE}/markets/{mkt_id}",
                        headers={"User-Agent": "foresight-poly/0.1"}, timeout=20)
    resp.raise_for_status()
    return resp.json()


# ---------- 纸面凯利 ----------

def kelly(p_model: float, p_market: float):
    """盲估 vs 盘价 → (下注侧, 成本价, 未封顶凯利比例)。side: "A"=买结果A，"B"=买结果B。"""
    if p_model >= p_market:
        side, p_s, q_s = "A", p_model, p_market
    else:
        side, p_s, q_s = "B", 1 - p_model, 1 - p_market
    if q_s <= 0 or q_s >= 1:
        return side, q_s, 0.0
    return side, q_s, max(0.0, (p_s - q_s) / (1 - q_s))


# ---------- 台账 ----------

def _load() -> list:
    if not os.path.exists(LEDGER):
        return []
    with open(LEDGER, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def _save(entries: list):
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    with open(LEDGER, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")


# ---------- rank / latest_batch / scan / resolve / stats ----------

def rank(llm, top: int = 8, limit: int = 100, fetcher=None, search_fn=None,
         exclude=None, verbose: bool = False) -> dict:
    """抓取 + 盲估，返回多个市场行、**不落台账**。GUI「扫盲估」用它展示，
    也是 scan 落账前的共用步骤（scan 传 exclude 跳过已在台账的市场，省 LLM 调用）。

    行内 code=市场id、name=市场问题——键名与 tidenow-web 前端 ScanStock 契约一致。"""
    date = time.strftime("%Y%m%d")
    raw = fetch_markets(limit=limit, fetcher=fetcher)
    exclude = exclude or set()

    cands, dropped, refused = [], {}, {}
    for m in raw:
        c, why = parse_market(m)
        if c is None:
            why = why.split("（")[0]  # 聚合同类原因（去掉具体数值，避免明细刷屏）
            dropped[why] = dropped.get(why, 0) + 1
            continue
        if c["mkt_id"] in exclude:
            dropped["已在台账（终身去重）"] = dropped.get("已在台账（终身去重）", 0) + 1
            continue
        r = refuse_reason(c["question"])
        if r:
            refused[r] = refused.get(r, 0) + 1
            if verbose:
                print(f'  ⊘ 拒测 {c["question"][:50]}｜{r}')
            continue
        cands.append(c)
    if verbose:
        print(f"  拉取 {len(raw)} 个市场 → 候选 {len(cands)}（过滤 {sum(dropped.values())}，拒测 {sum(refused.values())}）")
        for why, n in sorted(dropped.items(), key=lambda x: -x[1]):
            print(f"    - {why}: {n}")

    # 结构识别要在**截断到 top 之前**做：兄弟盘可能排在 top 之外，
    # 但"这场比赛还有别的选项""这问题还有别的期限"这件事本身必须让模型知道。
    cands = build_structure(cands)

    rows = []
    for c in cands[:top]:
        context = ""
        if search_fn is not None and not getattr(llm, "mock", False):
            try:
                context = search_fn(c["question"]) or ""
            except Exception:
                context = ""  # 搜索是尽力而为（落地问题#9），失败不阻塞盲估
        data, err = safe_chat_json(llm, POLY_PROMPT.format(
            question=c["question"], outcome_a=c["outcome_a"], outcome_b=c["outcome_b"],
            end_date=c["end_date"], today=time.strftime("%Y-%m-%d"),
            description=c["description"], structure=c.get("structure", ""),
            context=context and f"近期相关信息：\n{context}"),
            temperature=0.2)
        if err or not isinstance(data, dict):
            if verbose:
                print(f'  ✗ 跳过 {c["question"][:50]}｜LLM不可用：{err or "格式异常"}')
            continue  # 盲估失败就跳过：兜底写 0.5 只会稀释实验
        if not data.get("eligible", False):
            if verbose:
                print(f'  ⊘ LLM拒测 {c["question"][:50]}｜{str(data.get("refuse_reason", ""))[:60]}')
            continue
        if data.get("probability") is None:
            continue
        p_model = to_prob(data.get("probability"))
        edge = round(p_model - c["p_market"], 4)
        side, q_s, f_raw = kelly(p_model, c["p_market"])
        traded = abs(edge) >= EDGE_MIN
        rows.append({
            "code": c["mkt_id"], "name": c["question"],
            "outcome_a": c["outcome_a"], "outcome_b": c["outcome_b"],
            "url": f'https://polymarket.com/market/{c["slug"]}',
            "domain": str(data.get("domain", "other"))[:16],
            "end_date": c["end_date"], "liquidity": c["liquidity"],
            "p_model": round(p_model, 4), "p_market": c["p_market"], "edge": edge,
            "traded": traded, "side": side if traded else None,
            "entry_price": round(q_s, 4) if traded else None,
            "kelly_f": round(min(f_raw, KELLY_CAP), 4) if traded else None,
            "stake": round(BANKROLL * min(f_raw, KELLY_CAP), 2) if traded else None,
            "reason": str(data.get("reason", ""))[:120],
            "cluster": c.get("cluster", ""), "group_kind": c.get("group_kind", "solo"),
            "event_title": c.get("event_title", ""),
        })
        if verbose:
            mark = (f'▶ 纸面{("买A·" + rows[-1]["outcome_a"]) if side == "A" else ("买B·" + rows[-1]["outcome_b"])} '
                    f'{rows[-1]["stake"]:.1f}u') if traded else "○ 仅记录"
            print(f'  ✓ {c["question"][:46]}｜盲估{p_model:.0%} vs 盘价{c["p_market"]:.0%}（差{edge:+.0%}）{mark}')

    apply_cluster_cap(rows, verbose=verbose)
    diag = {"coherence": coherence_report(rows), "sharpness": sharpness(rows)}
    if verbose:
        _print_diagnostics(diag)
    return {"date": date, "stocks": rows, "diagnostics": diag}


def apply_cluster_cap(rows: list, verbose: bool = False) -> list:
    """同簇纸面敞口限额：超出 CLUSTER_CAP 就按比例缩，并记账说明缩过。

    凯利公式假设各注独立；预测市场里同主题的盘高度相关（霍尔木兹三个盘本质是
    同一件事的三种问法），不限额就是把 6% 的风险偷偷放大成 18%。"""
    cap = BANKROLL * CLUSTER_CAP
    by_cluster = {}
    for r in rows:
        if r["traded"] and r["stake"]:
            by_cluster.setdefault(r["cluster"], []).append(r)
    for key, g in by_cluster.items():
        total = sum(r["stake"] for r in g)
        if total <= cap + 1e-9 or len(g) < 2:
            continue
        scale = cap / total
        for r in g:
            r["stake_uncapped"] = r["stake"]
            r["stake"] = round(r["stake"] * scale, 2)
            r["capped_by_cluster"] = True
        if verbose:
            print(f"  ⚖️ 相关簇限额：{key[:44]} 共 {len(g)} 笔，"
                  f"合计 {total:.1f}u → 压到 {cap:.1f}u（×{scale:.2f}）")
    return rows


def _print_diagnostics(diag: dict):
    co, sh = diag.get("coherence", {}), diag.get("sharpness", {})
    print("\n  —— 本批诊断（不需等结算就能算）——")
    if sh:
        print(f"  锐度：模型 {sh['model_sharpness']:.3f} vs 市场 {sh['market_sharpness']:.3f}"
              f"（比值 {sh.get('sharpness_ratio')}）　往50%收敛 {sh['pulled_to_half']}")
        if sh.get("warning"):
            print(f"  ⚠️ {sh['warning']}")
    if co.get("sibling_groups") or co.get("ladder_groups"):
        print(f"  一致性：互斥组 {co['sibling_groups']} 个（违反 {co['sibling_violations']}）　"
              f"阶梯组 {co['ladder_groups']} 个（违反 {co['ladder_violations']}）　"
              f"市场自身违反 {co['market_violations']}")
        if co.get("sibling_worst"):
            w = co["sibling_worst"]
            print(f"  ✗ 互斥概率和 {w['sum']:.0%} > 100%：{w['markets']} = {w['probs']}")
        if co.get("ladder_worst"):
            w = co["ladder_worst"]
            print(f"  ✗ 阶梯非单调：{list(zip(w['dates'], w['probs']))}")


def latest_batch() -> dict:
    """台账里最近一批（可能已判定）。抓取失败时的降级展示。"""
    entries = _load()
    if not entries:
        return {"date": None, "stocks": [], "stale": True}
    last = max(e["batch"] for e in entries)
    rows = [e for e in entries if e["batch"] == last]
    rows.sort(key=lambda e: -abs(e.get("edge") or 0))
    stocks = [{
        "code": e["mkt_id"], "name": e["question"],
        "outcome_a": e.get("outcome_a", ""), "outcome_b": e.get("outcome_b", ""),
        "url": e.get("url", ""), "domain": e.get("domain", ""),
        "end_date": e.get("end_date", ""), "liquidity": e.get("liquidity"),
        "p_model": e.get("p_model"), "p_market": e.get("p_market"), "edge": e.get("edge"),
        "traded": e.get("traded"), "side": e.get("side"),
        "entry_price": e.get("entry_price"), "kelly_f": e.get("kelly_f"),
        "stake": e.get("stake"), "reason": e.get("reason", ""),
        "cluster": e.get("cluster", ""), "group_kind": e.get("group_kind", "solo"),
        "capped_by_cluster": e.get("capped_by_cluster", False),
        "outcome": e.get("outcome"), "pnl": e.get("pnl"),
    } for e in rows]
    return {"date": last, "stocks": stocks, "stale": True,
            "diagnostics": {"coherence": coherence_report(stocks),
                            "sharpness": sharpness(stocks)}}


def scan(llm, top: int = 12, limit: int = 100, fetcher=None, search_fn=None,
         verbose=True) -> list:
    """跑一次完整扫描并落账（同市场终身去重：一个市场只盲估一次）。"""
    date = time.strftime("%Y%m%d")
    entries = _load()
    seen = {e["mkt_id"] for e in entries}
    r = rank(llm, top=top, limit=limit, fetcher=fetcher, search_fn=search_fn,
             exclude=seen, verbose=verbose)
    added = []
    for row in r["stocks"]:
        e = {
            "id": f'pm-{row["code"]}', "batch": date, "mkt_id": row["code"],
            "question": row["name"], "outcome_a": row["outcome_a"], "outcome_b": row["outcome_b"],
            "url": row["url"], "domain": row["domain"],
            "end_date": row["end_date"], "liquidity": row["liquidity"],
            "p_model": row["p_model"], "p_market": row["p_market"], "edge": row["edge"],
            "traded": row["traded"], "side": row["side"],
            "entry_price": row["entry_price"], "kelly_f": row["kelly_f"], "stake": row["stake"],
            "reason": row["reason"],
            "cluster": row.get("cluster", ""), "group_kind": row.get("group_kind", "solo"),
            "capped_by_cluster": row.get("capped_by_cluster", False),
            "stake_uncapped": row.get("stake_uncapped"),
            "event_title": row.get("event_title", ""),
            "ts": time.strftime("%Y-%m-%d %H:%M"),
            "outcome": None, "resolved_ts": None, "pnl": None,
        }
        entries.append(e)
        added.append(e)
    _save(entries)
    if verbose:
        print(f"本批入账 {len(added)} 条（台账共 {len(entries)} 条）→ {LEDGER}")

    return added


def resolve_pending(fetcher=None, verbose=True) -> int:
    """逐条查询未判定市场：UMA 结算 → 记 outcome 与纸面盈亏；50-50 结算记 void。"""
    entries = _load()
    n = 0
    for e in entries:
        if e["outcome"] is not None:
            continue
        try:
            m = fetch_market(e["mkt_id"], fetcher=fetcher)
        except Exception as ex:
            if verbose:
                print(f'  ! {e["question"][:40]} 查询失败（{type(ex).__name__}），下次再试')
            continue
        if not m.get("closed"):
            continue  # 未结算（比赛延期等会保持 open）
        try:
            prices = [_f(p) for p in json.loads(m.get("outcomePrices") or "[]")]
        except (json.JSONDecodeError, TypeError):
            continue
        if len(prices) != 2:
            continue
        resolved = m.get("umaResolutionStatus") == "resolved" or prices[0] in (0.0, 1.0)
        if not resolved:
            continue
        if prices[0] >= 0.999:
            e["outcome"] = 1
        elif prices[0] <= 0.001:
            e["outcome"] = 0
        elif 0.45 <= prices[0] <= 0.55:
            e["outcome"] = "void"  # 取消/平局 50-50 结算，不入 Brier
        else:
            if verbose:
                print(f'  ? {e["question"][:40]} 结算价异常 {prices}，保持待判定')
            continue
        if e["traded"]:
            q = e["entry_price"]
            settle = {1: (1.0 if e["side"] == "A" else 0.0),
                      0: (0.0 if e["side"] == "A" else 1.0)}.get(e["outcome"], 0.5)
            e["pnl"] = round(e["stake"] * (settle - q) / q, 2)
        e["resolved_ts"] = time.strftime("%Y-%m-%d %H:%M")
        n += 1
        if verbose:
            tag = {1: f'结果A「{e["outcome_a"][:20]}」✓', 0: f'结果B「{e["outcome_b"][:20]}」✓',
                   "void": "50-50取消"}[e["outcome"]]
            pnl = f'｜纸面{e["pnl"]:+.1f}u' if e["pnl"] is not None else ""
            print(f'  {tag} {e["question"][:40]} 盲估{e["p_model"]:.0%} vs 盘价{e["p_market"]:.0%}{pnl}')
    _save(entries)
    if verbose:
        print(f"本次判定 {n} 条")
    return n


def stats() -> dict:
    """双 Brier（模型盲估 vs 市场价）+ 纸面盈亏分开呈现——预测准不准、钱赚不赚是两个问题。"""
    entries = _load()
    done = [e for e in entries if e["outcome"] in (0, 1)]
    void = [e for e in entries if e["outcome"] == "void"]
    out = {"total": len(entries), "resolved": len(done), "void": len(void),
           "pending": len(entries) - len(done) - len(void)}
    # 锐度与一致性不需要等结算——台账一有条目就能看，是最早可得的质量信号
    all_rows = [{"p_model": e["p_model"], "p_market": e["p_market"],
                 "cluster": e.get("cluster", ""), "name": e.get("question", ""),
                 "end_date": e.get("end_date", "")} for e in entries]
    if all_rows:
        out["sharpness"] = sharpness(all_rows)
        out["coherence"] = coherence_report(all_rows)
    if not done:
        out["note"] = "尚无已结算条目；scan 后等市场到期跑 resolve（锐度/一致性已可看）"
        return out
    bm = sum((e["p_model"] - e["outcome"]) ** 2 for e in done) / len(done)
    bp = sum((e["p_market"] - e["outcome"]) ** 2 for e in done) / len(done)
    out["brier_model"] = round(bm, 4)
    out["brier_market"] = round(bp, 4)
    out["brier_gap"] = round(bm - bp, 4)
    out["verdict"] = ("模型跑赢市场价（继续观察样本量）" if bm < bp
                      else "市场价更准（符合预注册假设：盘价已聚合公共信息）")
    by_domain = {}
    for e in done:
        by_domain.setdefault(e["domain"], []).append((e["p_model"] - e["outcome"]) ** 2)
    out["by_domain_model_brier"] = {k: round(sum(v) / len(v), 4) for k, v in by_domain.items()}
    trades = [e for e in done + void if e["traded"] and e["pnl"] is not None]
    if trades:
        wins = [e for e in trades if e["pnl"] > 0]
        out["paper_trades"] = len(trades)
        out["paper_pnl_sum"] = round(sum(e["pnl"] for e in trades), 2)
        out["paper_win_rate"] = round(len(wins) / len(trades), 3)
        out["paper_note"] = (f"虚拟本金{BANKROLL:.0f}u、不复利、无点差滑点费用的乐观上界；"
                             f"触发线|差|≥{EDGE_MIN:.0%}、凯利上限{KELLY_CAP:.0%}——非投注建议")
    out["hypothesis"] = "预注册：模型Brier差于市场、纸面盈亏≤0；被数据推翻才算发现"
    return out
