"""randomness：纯随机事件后端（彩票、轮盘、骰子、抽签）。

这是一个"反预测"后端：检测到数学上不可预测的事件时，拒绝给出号码/结果预测，
改为输出期望值数学（EV、庄家优势、破产概率直觉），并且不写入校准日志——
往 Brier 记录里塞随机事件预测只会污染数据。
"""
from __future__ import annotations

import random

from .common import safe_chat_json


def _lucky_numbers(rules) -> list:
    """按 LLM 识别的规则，用真随机（random.sample）生成一组号码。
    号码由 Python 生成而非 LLM —— LLM 会有数字偏好，且"AI 选的号"是危险
    的暗示。每个号池等概率抽取，明确不改变期望值，纯娱乐。"""
    if not isinstance(rules, dict):
        return []
    pools = rules.get("pools")
    if not isinstance(pools, list):
        return []
    out = []
    for p in pools:
        try:
            lo, hi, pick = int(p["min"]), int(p["max"]), int(p["pick"])
            name = str(p.get("name", ""))
        except (KeyError, TypeError, ValueError):
            continue
        if hi < lo or pick < 1 or pick > (hi - lo + 1) or (hi - lo + 1) > 200:
            continue
        nums = sorted(random.sample(range(lo, hi + 1), pick))
        out.append({"name": name, "numbers": nums})
    return out

RANDOM_PROMPT = """你是一个概率数学讲解者。用户询问的是一个不可预测的随机事件。

事件：
{seed}

要求：
1. 在 why_unpredictable 用一两句话解释为什么任何"预测"都无效（独立同分布/无记忆性，历史号码不影响未来）
2. 给出该游戏的期望回报数学：单注期望值/返奖率/庄家优势（若是知名游戏给具体数字，如中国双色球返奖率约50%；不确定就说明）
3. 给出一条理性建议（如把支出当娱乐预算而非投资）
4. 若用户的问题里其实混有"可预测部分"（如彩票销售额趋势），在 predictable_part 指出并建议改问
5. 若是选号型彩票（双色球/大乐透/福彩3D/体彩等），在 number_rules 给出选号规则，供系统生成一组随机号码作娱乐；
   非选号型（轮盘/骰子等）number_rules 为 null

只返回 JSON：
{{
  "game": "...",
  "why_unpredictable": "...",
  "ev_math": "...",
  "rational_advice": "...",
  "predictable_part": null,
  "number_rules": {{"pools": [{{"name": "红球", "min": 1, "max": 33, "pick": 6}}, {{"name": "蓝球", "min": 1, "max": 16, "pick": 1}}]}}
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, RANDOM_PROMPT.format(seed=seed[:1500]), temperature=0.2)
    if err:
        return {"backend": "randomness", "error": err}
    if verbose:
        print(f"  ✓ 识别为纯随机事件：{data.get('game')}")
    lucky = _lucky_numbers(data.get("number_rules"))
    return {
        "backend": "randomness",
        "game": data.get("game", ""),
        "why_unpredictable": data.get("why_unpredictable", ""),
        "ev_math": data.get("ev_math", ""),
        "rational_advice": data.get("rational_advice", ""),
        "predictable_part": data.get("predictable_part"),
        "lucky_numbers": lucky,  # 娱乐随机号，Python 真随机生成
        "no_prediction": True,  # 不写入校准日志
        "caveat": "拒绝预测随机数不是能力不足，而是数学诚实；声称能预测彩票的系统都在骗你。",
    }
