"""metaphysics：玄学/命理后端（星座、周易、八字、风水、塔罗、紫微）。

诚实定位（这个域最容易滑向诈骗，边界必须先立清楚）：
- 这不是"预测未来会发生什么"，而是"按某个传统体系给出一套解读框架"
- 输出明确标注"传统文化娱乐，非科学预测，不构成任何决策依据"
- 不写入校准日志（no_prediction）——玄学解读无法用 Brier 分数客观判定对错，
  塞进校准记录只会污染数据，也会假装它"可验证"

设计思路（把领域知识当"skill"注入 prompt）：
识别子体系 → 调用对应体系的规则框架（卦象/星座相位/十神…）→ 按体系逻辑
自洽地推演 → 落到"倾向/建议"而非"铁口直断"。让 LLM 像个懂行的解读者，
而不是瞎编。
"""
from __future__ import annotations

from .common import safe_chat_json

# 各子体系的知识框架（skill）。让模型按体系内部逻辑推演，而非笼统胡诌。
SYSTEM_KNOWLEDGE = """各体系的知识框架，按识别到的 sub_system 调用对应规则：

【zodiac 西方占星】
- 12 星座（白羊…双鱼）× 四象（火土风水）× 三态（本位/固定/变动）
- 若信息足够，考虑太阳/月亮/上升的分工，以及主要相位（合/冲/刑/拱/六合）
- 落点：性格倾向、当前运势侧重、相处/决策建议

【bazi 八字命理（子平）】
- 天干地支、五行生克、十神（正官偏印食神…）、大运流年
- 看日主强弱、喜用神、当前流年与命局的作用关系
- 落点：性格与格局倾向、近期宜忌方向

【yijing 周易卦象】
- 64 卦 + 六爻，可用简化起卦（时间起卦/报数）
- 解本卦卦辞、变爻爻辞、之卦，取象类比现实处境
- 落点：处境判断 + 行动倾向（潜龙勿用 / 见龙在田式的时机建议）

【fengshui 风水堪舆】
- 峦头（形）与理气（气）、方位五行、气的流动与聚散
- 就描述的空间/朝向给出调整方向
- 落点：环境与状态的关系，可操作的小建议

【ziwei 紫微斗数】
- 命宫十二宫、主星（紫微天机太阳…）、四化（禄权科忌）
- 落点：命盘格局倾向

【tarot 塔罗】
- 大阿卡纳 22 张 + 小阿卡纳，正逆位
- 就抽到/指定的牌阵给出象征解读
- 落点：当下能量与心理投射，非宿命断言
"""

METAPHYSICS_PROMPT = """你是一个懂行的传统玄学解读者（星座/周易/八字/风水/紫微/塔罗）。
用户想要一次玄学解读。你要按对应体系的**内部逻辑自洽地推演**，像个内行，而不是笼统胡诌。

**但你必须诚实**：这是传统文化解读与娱乐，不是科学预测。用词要用"倾向/宜/象征/时机未到"这类，
不要用"必将/一定/铁定"这种铁口直断。绝不承诺具体的钱、病、生死结果。

{knowledge}

事件/问题：
{seed}

要求：
1. 识别 sub_system（zodiac|bazi|yijing|fengshui|ziwei|tarot），信息不足时选最贴切的并说明
2. 按该体系的规则做一次自洽解读（用到体系内的具体概念：卦名/星座相位/十神/主星等）
3. 给出"倾向性判断 + 可操作的小建议"，落地、温和、不吓人
4. 给一句诚实提醒：这是传统文化娱乐视角

只返回 JSON：
{{
  "sub_system": "zodiac|bazi|yijing|fengshui|ziwei|tarot",
  "reading": "按体系逻辑的解读正文（可分几段，用到体系内具体概念）",
  "key_symbols": ["卦名/星座/主星/牌面 等本次用到的关键符号"],
  "tendency": "一句话倾向性判断（宜/忌/时机/侧重）",
  "advice": "一条温和可操作的建议",
  "honest_note": "这是传统文化解读与娱乐，非科学预测，不构成决策依据"
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(
        llm,
        METAPHYSICS_PROMPT.format(knowledge=SYSTEM_KNOWLEDGE, seed=seed[:2000]),
        temperature=0.7,  # 解读需要一点发挥空间
    )
    if err:
        return {"backend": "metaphysics", "error": err}
    if verbose:
        print(f"  ✓ 玄学子体系：{data.get('sub_system')}")
    return {
        "backend": "metaphysics",
        "sub_system": data.get("sub_system", ""),
        "reading": data.get("reading", ""),
        "key_symbols": data.get("key_symbols", []),
        "tendency": data.get("tendency", ""),
        "advice": data.get("advice", ""),
        "honest_note": data.get("honest_note", "传统文化解读与娱乐，非科学预测。"),
        "no_prediction": True,  # 玄学不写入校准日志
        "caveat": "玄学解读属传统文化与娱乐范畴，无科学可验证性；请勿据此做医疗、投资、婚姻等重大决策。",
    }
