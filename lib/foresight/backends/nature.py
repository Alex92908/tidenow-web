"""nature：天气/气候/自然灾害后端。

诚实原则（这个域最容易胡说）：
- 短期天气（≤14天）：数值天气预报是物理仿真问题，LLM 做不了 → 明确告知查气象台，只给气候学背景
- 季节性/灾害频率（台风登陆数、汛期降水）：气候学基率可以给
- 短期地震预测：科学上不可能 → 直接拒绝预测具体地震，只给长期概率（如断层带年发生率）
"""
from __future__ import annotations

from .common import safe_chat_json

NATURE_PROMPT = """你是一个自然事件分析师，严格遵循科学边界。

事件：
{seed}

第一步：判断子类型 sub_type，三选一：
- "short_weather"：≤14天的具体天气 → 你必须在 honest_note 说明这需要数值天气预报、请查气象部门，你只能给气候学背景（该地该时节的历史统计）
- "seasonal"：季节尺度的频率/强度（台风个数、汛期降水偏多偏少、极端高温日数）→ 给气候学基率 + ENSO等已知调制因素
- "earthquake_shortterm"：预测具体时间地点的地震 → 在 honest_note 明确说明短期地震预测在科学上不可行，只给该区域长期年化基率

第二步：在科学允许范围内给出基率预测与概率。
第三步：若为 seasonal 类，额外给出置信度（高/中/低）、2-3 条关键假设、一句"什么会改变判断"；
若上方种子带有【实时搜索结果】，引用 ENSO/气象台数据时请用（来源：标题）标注。

只返回 JSON：
{{
  "sub_type": "short_weather|seasonal|earthquake_shortterm",
  "honest_note": "...",
  "climatology_base_rate": "...",
  "modulating_factors": ["..."],
  "key_question": "（仅 seasonal 类给出可判定问题；其他类可为 null）",
  "key_question_probability": null,
  "confidence": "高|中|低",
  "key_assumptions": ["...", "..."],
  "what_would_change_my_mind": "..."
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, NATURE_PROMPT.format(seed=seed[:2000]), temperature=0.2)
    if err:
        return {"backend": "nature", "error": err}
    sub = data.get("sub_type", "seasonal")
    kq = data.get("key_question")
    no_prediction = sub != "seasonal" or not kq
    if verbose:
        print(f"  ✓ 子类型：{sub}{'（不产生可校准预测）' if no_prediction else ''}")
    return {
        "backend": "nature",
        "sub_type": sub,
        "honest_note": data.get("honest_note", ""),
        "climatology_base_rate": data.get("climatology_base_rate", ""),
        "modulating_factors": data.get("modulating_factors", []),
        "key_question": kq or "（该子类型不产生可判定预测）",
        "probability": data.get("key_question_probability", 0.5),
        "no_prediction": no_prediction,
        "confidence": "" if no_prediction else data.get("confidence", ""),
        "key_assumptions": [] if no_prediction else data.get("key_assumptions", []),
        "what_would_change_my_mind": "" if no_prediction else data.get("what_would_change_my_mind", ""),
        "caveat": "短期天气请以气象台数值预报为准；任何声称能预测具体地震的说法都不科学。",
    }
