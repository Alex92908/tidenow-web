"""randomness：纯随机事件后端（彩票、轮盘、骰子、抽签）。

这是一个"反预测"后端：检测到数学上不可预测的事件时，拒绝给出号码/结果预测，
改为输出期望值数学（EV、庄家优势、破产概率直觉），并且不写入校准日志——
往 Brier 记录里塞随机事件预测只会污染数据。
"""
from __future__ import annotations

from .common import safe_chat_json

RANDOM_PROMPT = """你是一个概率数学讲解者。用户询问的是一个不可预测的随机事件。

事件：
{seed}

要求：
1. 在 why_unpredictable 用一两句话解释为什么任何"预测"都无效（独立同分布/无记忆性，历史号码不影响未来）
2. 给出该游戏的期望回报数学：单注期望值/返奖率/庄家优势（若是知名游戏给具体数字，如中国双色球返奖率约50%；不确定就说明）
3. 给出一条理性建议（如把支出当娱乐预算而非投资）
4. 若用户的问题里其实混有"可预测部分"（如彩票销售额趋势），在 predictable_part 指出并建议改问

只返回 JSON：
{{
  "game": "...",
  "why_unpredictable": "...",
  "ev_math": "...",
  "rational_advice": "...",
  "predictable_part": null
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, RANDOM_PROMPT.format(seed=seed[:1500]), temperature=0.2)
    if err:
        return {"backend": "randomness", "error": err}
    if verbose:
        print(f"  ✓ 识别为纯随机事件：{data.get('game')}")
    return {
        "backend": "randomness",
        "game": data.get("game", ""),
        "why_unpredictable": data.get("why_unpredictable", ""),
        "ev_math": data.get("ev_math", ""),
        "rational_advice": data.get("rational_advice", ""),
        "predictable_part": data.get("predictable_part"),
        "no_prediction": True,  # 不写入校准日志
        "caveat": "拒绝预测随机数不是能力不足，而是数学诚实；声称能预测彩票的系统都在骗你。",
    }
