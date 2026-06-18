"""trend：消费 / 生活方式 / 产品趋势后端（衣食住行、科技产品采用）。

方法：S 曲线阶段判断（萌芽/早期采用/跨越鸿沟/主流/饱和/衰退）
+ 驱动与阻力分析 + 3/6/12 个月展望。
"""
from __future__ import annotations

from .common import safe_chat_json

TREND_PROMPT = """你是一个消费与生活方式趋势分析师，使用技术采用生命周期（S曲线）框架。

趋势/产品：
{seed}

要求：
1. 判断当前所处 S 曲线阶段：萌芽期 / 早期采用 / 跨越鸿沟 / 主流扩散 / 饱和 / 衰退
2. 列出 2-3 个核心驱动力和 2-3 个核心阻力
3. 给出 3 / 6 / 12 个月的展望（各一句话 + 热度走向：升温/持平/降温）
4. 警惕"昙花一现"模式：判断它更像持久趋势还是短期热点，并给出依据
5. 提炼可判定的核心问题（含期限）

只返回 JSON：
{{
  "stage": "...",
  "drivers": ["..."],
  "blockers": ["..."],
  "outlook": [
    {{"horizon": "3个月", "direction": "升温|持平|降温", "note": "..."}},
    {{"horizon": "6个月", "direction": "...", "note": "..."}},
    {{"horizon": "12个月", "direction": "...", "note": "..."}}
  ],
  "fad_or_trend": {{"verdict": "持久趋势|短期热点|待观察", "reason": "..."}},
  "key_question": "未来X个月该趋势是否……？",
  "key_question_probability": 0.5
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, TREND_PROMPT.format(seed=seed[:2000]), temperature=0.4)
    if err:
        return {"backend": "trend", "error": err}
    if verbose:
        print(f"  ✓ 阶段：{data.get('stage')}  判定：{data.get('fad_or_trend', {}).get('verdict')}")

    return {
        "backend": "trend",
        "stage": data.get("stage", ""),
        "drivers": data.get("drivers", []),
        "blockers": data.get("blockers", []),
        "outlook": data.get("outlook", []),
        "fad_or_trend": data.get("fad_or_trend", {}),
        "key_question": data.get("key_question", seed[:60]),
        "probability": data.get("key_question_probability", 0.5),
        "caveat": "趋势判断基于公开叙事，可能滞后于实际数据；建议与搜索指数/销量数据交叉验证。",
    }
