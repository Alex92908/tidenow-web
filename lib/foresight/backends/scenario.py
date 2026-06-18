"""scenario：军事 / 外交 / 科技 / 政策的情景树分析后端。

方法论参考超级预测（Superforecasting）：
1. 先找外部视角（base rate：历史同类事件的基率）
2. 生成 2-4 个互斥情景，分配概率（总和=1）
3. 每个情景列出可观测的先行指标（用于后续校准）
4. 提炼一个可判定的核心预测问题（便于事后打 Brier 分）
"""
from __future__ import annotations

from .common import safe_chat_json

SCENARIO_PROMPT = """你是一个遵循超级预测方法论的分析师。针对以下事件，输出情景树分析。

要求：
1. 先给出"外部视角"：历史上同类事件的基率（base rate），作为锚点
2. 生成 2-4 个互斥情景，概率总和为 1.0，概率要从基率出发再根据本案细节调整
3. 每个情景列出 2-3 个可观测的先行指标（未来几周可以验证的信号）
4. 提炼一个可明确判定真假的核心预测问题（含时间期限），并给出你的概率

事件：
{seed}

只返回 JSON：
{{
  "base_rate_note": "...",
  "scenarios": [
    {{"name": "...", "probability": 0.5, "description": "...", "indicators": ["...", "..."]}}
  ],
  "key_question": "未来X天内，是否……？",
  "key_question_probability": 0.35,
  "what_would_change_my_mind": "..."
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, SCENARIO_PROMPT.format(seed=seed[:3000]), temperature=0.3)
    if err:
        return {"backend": "scenario", "error": err}
    scenarios = data.get("scenarios", [])
    if not isinstance(scenarios, list):
        scenarios = []
    # 概率归一化
    from .common import to_prob
    total = sum(to_prob(s.get("probability"), 0) for s in scenarios) or 1
    for s in scenarios:
        s["probability"] = round(to_prob(s.get("probability"), 0) / total, 3)
    if verbose:
        for s in scenarios:
            print(f"  ✓ {s['name']}: {s['probability']:.0%}")

    return {
        "backend": "scenario",
        "base_rate_note": data.get("base_rate_note", ""),
        "scenarios": scenarios,
        "key_question": data.get("key_question", ""),
        "probability": data.get("key_question_probability", 0.5),
        "what_would_change_my_mind": data.get("what_would_change_my_mind", ""),
        "caveat": "LLM 的地缘/科技预测易受训练语料叙事影响；建议与 Metaculus / Polymarket 同题赔率对照后再采信。",
    }
