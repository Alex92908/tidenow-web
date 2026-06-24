"""sports：体育赛事预测后端。

方法：基率分析（主场优势、历史交锋、近期状态）→ 各结果概率分布。
诚实原则：LLM 没有实时阵容/伤病/赔率数据；若用户提供博彩赔率，
会先换算成隐含概率（去水）作为锚点，LLM 只做小幅修正——
长期来看跑赢市场赔率几乎不可能，系统目标是"不显著差于赔率"。

支持两种模式：
- 单场比赛：A vs B 胜负预测（赔率锚点）
- 锦标赛/赛季：夺冠/排名等多选手/多队伍的竞争预测（历史基率+实力梯队）
"""
from __future__ import annotations

from .common import safe_chat_json

SPORTS_PROMPT = """你是一个克制的体育赛事分析师，遵循基率优先原则。

事件：
{seed}

{odds_section}

要求：
1. 识别比赛双方与赛事类型；若信息不足以判断是哪场比赛，在 "error" 字段说明
2. 列出你依据的基率因素（主场优势、历史交锋、近期状态等），并标注哪些是你确定知道的、哪些是猜测
3. 给出各结果的概率（总和=1.0）及一句理由；若提供了赔率隐含概率，以它为锚点，偏离不超过±8个百分点并说明理由
4. 给出可判定的核心问题
5. 给出置信度（高/中/低）+ 2-3 条关键假设 + 一句"什么会改变判断"
6. 若上方种子带有【实时搜索结果】，引用阵容/伤病/状态时请用（来源：标题）标注

只返回 JSON：
{{
  "error": null,
  "match": "A vs B（赛事名）",
  "base_rate_factors": [{{"factor": "...", "certainty": "确定|猜测"}}],
  "outcomes": [{{"name": "主胜", "probability": 0.45, "rationale": "..."}}, {{"name": "平局", "probability": 0.27, "rationale": "..."}}, {{"name": "客胜", "probability": 0.28, "rationale": "..."}}],
  "key_question": "X月X日比赛中A是否获胜？",
  "key_question_probability": 0.45,
  "confidence": "高|中|低",
  "key_assumptions": ["...", "..."],
  "what_would_change_my_mind": "..."
}}
"""

TOURNAMENT_PROMPT = """你是一个克制的体育赛事分析师，遵循基率优先原则。
用户询问的是一个锦标赛/赛季级别的预测（如世界杯冠军、联赛冠军、MVP等），不是单场比赛。

事件：
{seed}

要求：
1. 识别赛事名称、赛制和当前阶段
2. 列出影响结果的关键基率因素（历史夺冠规律、实力梯队、东道主效应等），标注确定/猜测
3. 列出 4-8 个最有竞争力的候选（队伍/选手），给出各自夺冠概率（总和=1.0）
4. 提炼一个可判定的核心预测问题

只返回 JSON：
{{
  "error": null,
  "tournament": "赛事名称与届次",
  "stage": "当前阶段（未开赛/小组赛/淘汰赛等）",
  "base_rate_factors": [{{"factor": "...", "certainty": "确定|猜测"}}],
  "contenders": [
    {{"name": "...", "probability": 0.25, "rationale": "一句话理由"}}
  ],
  "key_question": "X赛事的冠军是否为Y？",
  "key_question_probability": 0.25,
  "confidence": "高|中|低",
  "key_assumptions": ["...", "..."],
  "what_would_change_my_mind": "..."
}}
"""


def implied_prob(odds: list[float]) -> list[float]:
    """欧赔 → 去水隐含概率。"""
    inv = [1 / o for o in odds if o > 1]
    total = sum(inv)
    return [round(x / total, 3) for x in inv] if total else []


def _run_match(llm, seed: str, odds: str | None, verbose: bool) -> dict:
    """单场比赛预测。"""
    odds_section = ""
    anchor = None
    if odds:
        try:
            vals = [float(x) for x in odds.replace("，", ",").split(",")]
            anchor = implied_prob(vals)
            odds_section = f"博彩赔率：{vals}，去水后隐含概率：{anchor}（请以此为锚点）"
        except ValueError:
            odds_section = f"（用户提供的赔率格式无法解析：{odds}）"

    data, err = safe_chat_json(llm, SPORTS_PROMPT.format(seed=seed[:1500], odds_section=odds_section),
                               temperature=0.2)
    if err:
        return {"backend": "sports", "error": err}
    if data.get("error"):
        return {"backend": "sports", "error": str(data["error"]),
                "_try_tournament": True}

    outcomes = data.get("outcomes", [])
    total = sum(float(o.get("probability", 0) or 0) for o in outcomes) or 1
    for o in outcomes:
        o["probability"] = round(float(o.get("probability", 0) or 0) / total, 3)
    if verbose:
        for o in outcomes:
            print(f"  ✓ {o.get('name')}: {o['probability']:.0%}")

    return {
        "backend": "sports",
        "match": data.get("match", ""),
        "base_rate_factors": data.get("base_rate_factors", []),
        "outcomes": outcomes,
        "implied_from_odds": anchor,
        "key_question": data.get("key_question", seed[:60]),
        "probability": data.get("key_question_probability", 0.5),
        "confidence": data.get("confidence", ""),
        "key_assumptions": data.get("key_assumptions", []),
        "what_would_change_my_mind": data.get("what_would_change_my_mind", ""),
        "caveat": "LLM 无实时阵容/伤病数据；长期跑赢博彩赔率几乎不可能，本结果用于'不显著差于赔率'的参考，不构成投注建议。",
    }


def _run_tournament(llm, seed: str, verbose: bool) -> dict:
    """锦标赛/赛季级别预测。"""
    data, err = safe_chat_json(llm, TOURNAMENT_PROMPT.format(seed=seed[:2000]),
                               temperature=0.3)
    if err:
        return {"backend": "sports", "error": err}
    if data.get("error"):
        return {"backend": "sports", "error": str(data["error"])}

    contenders = data.get("contenders", [])
    if not isinstance(contenders, list):
        contenders = []
    from .common import to_prob
    total = sum(to_prob(c.get("probability"), 0) for c in contenders) or 1
    for c in contenders:
        c["probability"] = round(to_prob(c.get("probability"), 0) / total, 3)
    if verbose:
        for c in contenders:
            print(f"  ✓ {c.get('name')}: {c['probability']:.0%}")

    top = contenders[0] if contenders else None
    return {
        "backend": "sports",
        "mode": "tournament",
        "tournament": data.get("tournament", ""),
        "stage": data.get("stage", ""),
        "base_rate_factors": data.get("base_rate_factors", []),
        "contenders": contenders,
        "key_question": data.get("key_question", seed[:60]),
        "probability": data.get("key_question_probability",
                                top["probability"] if top else 0.5),
        "confidence": data.get("confidence", ""),
        "key_assumptions": data.get("key_assumptions", []),
        "what_would_change_my_mind": data.get("what_would_change_my_mind", ""),
        "caveat": "LLM 无实时赛事数据（伤病/状态/签表）；锦标赛预测不确定性极高，概率仅反映赛前基率评估。",
    }


def run(llm, seed: str, odds: str | None = None, verbose: bool = True) -> dict:
    result = _run_match(llm, seed, odds, verbose)
    if result.get("_try_tournament"):
        if verbose:
            print("  → 非单场比赛，切换到锦标赛模式…")
        result = _run_tournament(llm, seed, verbose)
    return result
