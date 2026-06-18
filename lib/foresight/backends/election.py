"""election：选举/政治投票预测后端。

方法论：民调聚合 + 历史民调误差带。与 scenario 的区别在于有结构化锚点（民调），
核心是"民调读数 ± 该类选举的历史系统性误差"，而不是叙事推演。
"""
from __future__ import annotations

from .common import safe_chat_json, to_prob

ELECTION_PROMPT = """你是一个选举预测分析师，遵循民调聚合方法论。注意你的训练数据有截止时间。

选举/投票事件：
{seed}

要求：
1. 识别选举类型与时间；信息不足在 "error" 说明
2. 给出你所知的最近民调/支持率锚点，标注数据时效与"可能已过期"警告
3. 给出该国家/该类选举的历史民调误差幅度（如美国大选州级民调误差约±3-4个百分点），并说明误差通常偏向哪方（若有系统性模式）
4. 输出各候选人/选项的获胜概率（总和=1.0）：从民调锚点出发，按误差带和剩余时间展开
5. 提炼可判定的核心问题

只返回 JSON：
{{
  "error": null,
  "race": "...",
  "poll_anchor": {{"value": "...", "as_of": "...", "staleness_warning": "..."}},
  "historical_polling_error": "...",
  "outcomes": [{{"name": "...", "probability": 0.5}}],
  "key_question": "X年X月选举中A是否获胜？",
  "key_question_probability": 0.5,
  "what_would_change_my_mind": "..."
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, ELECTION_PROMPT.format(seed=seed[:2000]), temperature=0.2)
    if err:
        return {"backend": "election", "error": err}
    if data.get("error"):
        return {"backend": "election", "error": str(data["error"])}
    outcomes = data.get("outcomes", []) if isinstance(data.get("outcomes"), list) else []
    total = sum(to_prob(o.get("probability"), 0) for o in outcomes) or 1
    for o in outcomes:
        o["probability"] = round(to_prob(o.get("probability"), 0) / total, 3)
    if verbose:
        for o in outcomes:
            print(f"  ✓ {o.get('name')}: {o['probability']:.0%}")
    return {
        "backend": "election",
        "race": data.get("race", ""),
        "poll_anchor": data.get("poll_anchor", {}),
        "historical_polling_error": data.get("historical_polling_error", ""),
        "outcomes": outcomes,
        "key_question": data.get("key_question", seed[:60]),
        "probability": data.get("key_question_probability", 0.5),
        "what_would_change_my_mind": data.get("what_would_change_my_mind", ""),
        "caveat": "民调锚点可能已过期，务必用最新民调聚合（如 538/RCP 类站点）覆盖；临近选举日民调误差仍可达数个百分点。",
    }
