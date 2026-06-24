"""macro：宏观经济指标预测后端（CPI / 利率 / 汇率 / GDP / 失业率等）。

方法：识别目标指标 → 当前已知锚点（标注数据时效）→ 区间预测 + 概率，
强制输出"市场一致预期对照"提示，因为 LLM 训练数据有截止时间，
最新读数必须由用户核实。
"""
from __future__ import annotations

from .common import safe_chat_json

MACRO_PROMPT = """你是一个宏观经济分析师。注意：你的训练数据有截止时间，最新经济数据你可能不知道。

任务：
{seed}

要求：
1. 识别目标指标与预测期限；信息不足则在 "error" 说明
2. 给出你所知的最近锚点数值，并明确标注"该数据截至何时、可能已过期"
3. 输出区间预测（悲观/基准/乐观三档，各自概率，总和=1.0），每档给一句"为何是这个区间"的理由
4. 列出 2-3 个会改变判断的先行数据（如下月 PMI、央行会议）
5. 提炼可判定的核心问题（含数值阈值和期限）
6. 给出置信度（高/中/低）+ 2-3 条关键假设 + 一句"什么会改变判断"
7. 若上方种子带有【实时搜索结果】，引用其中数据时请用（来源：标题）标注

只返回 JSON：
{{
  "error": null,
  "indicator": "...",
  "anchor": {{"value": "...", "as_of": "...", "staleness_warning": "..."}},
  "ranges": [
    {{"name": "悲观", "range": "...", "probability": 0.2, "rationale": "..."}},
    {{"name": "基准", "range": "...", "probability": 0.6, "rationale": "..."}},
    {{"name": "乐观", "range": "...", "probability": 0.2, "rationale": "..."}}
  ],
  "leading_data": ["...", "..."],
  "key_question": "X月公布的Y指标是否高于Z？",
  "key_question_probability": 0.6,
  "confidence": "高|中|低",
  "key_assumptions": ["...", "..."],
  "what_would_change_my_mind": "..."
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, MACRO_PROMPT.format(seed=seed[:2000]), temperature=0.2)
    if err:
        return {"backend": "macro", "error": err}
    if data.get("error"):
        return {"backend": "macro", "error": str(data["error"])}

    ranges = data.get("ranges", [])
    total = sum(float(r.get("probability", 0) or 0) for r in ranges) or 1
    for r in ranges:
        r["probability"] = round(float(r.get("probability", 0) or 0) / total, 3)
    if verbose:
        for r in ranges:
            print(f"  ✓ {r.get('name')} {r.get('range')}: {r['probability']:.0%}")

    return {
        "backend": "macro",
        "indicator": data.get("indicator", ""),
        "anchor": data.get("anchor", {}),
        "ranges": ranges,
        "leading_data": data.get("leading_data", []),
        "key_question": data.get("key_question", seed[:60]),
        "probability": data.get("key_question_probability", 0.5),
        "confidence": data.get("confidence", ""),
        "key_assumptions": data.get("key_assumptions", []),
        "what_would_change_my_mind": data.get("what_would_change_my_mind", ""),
        "caveat": "LLM 锚点数据可能过期，发布前务必核实最新读数与市场一致预期（如 Wind/财新调查中值）。",
    }
