"""boxoffice：影视票房/流媒体表现预测后端。

方法论：对标影片法（comparable titles）——找 3 部同类型/同档期/同量级对标片，
用它们的实际票房构造 P25/P50/P75 区间，再按本片差异微调。
"""
from __future__ import annotations

from .common import safe_chat_json, to_prob

BOXOFFICE_PROMPT = """你是一个票房分析师，使用对标影片法。注意你的训练数据有截止时间，近期影片你可能不知道。

影片/剧集：
{seed}

要求：
1. 识别影片与市场（中国内地/北美/全球）；若你完全不认识该片，在 "error" 中说明并建议用户提供类型/主创/档期信息
2. 列出 3 部对标影片及其实际票房（标注你的数据可能过期）
3. 由对标构造三档票房区间（低/中/高）及概率（总和=1.0），说明本片相对对标的上调/下调理由
4. 列出 2-3 个上映前可观测的先行指标（想看数、预售、口碑解禁）
5. 提炼可判定的核心问题（含票房阈值）

只返回 JSON：
{{
  "error": null,
  "title": "...",
  "market": "...",
  "comparables": [{{"title": "...", "gross": "...", "note": "..."}}],
  "ranges": [{{"name": "低", "range": "...", "probability": 0.25}}, {{"name": "中", "range": "...", "probability": 0.5}}, {{"name": "高", "range": "...", "probability": 0.25}}],
  "leading_indicators": ["...", "..."],
  "key_question": "该片最终票房是否超过X亿？",
  "key_question_probability": 0.5
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, BOXOFFICE_PROMPT.format(seed=seed[:2000]), temperature=0.3)
    if err:
        return {"backend": "boxoffice", "error": err}
    if data.get("error"):
        return {"backend": "boxoffice", "error": str(data["error"])}
    ranges = data.get("ranges", []) if isinstance(data.get("ranges"), list) else []
    total = sum(to_prob(r.get("probability"), 0) for r in ranges) or 1
    for r in ranges:
        r["probability"] = round(to_prob(r.get("probability"), 0) / total, 3)
    if verbose:
        for r in ranges:
            print(f"  ✓ {r.get('name')} {r.get('range')}: {r['probability']:.0%}")
    return {
        "backend": "boxoffice",
        "title": data.get("title", ""),
        "market": data.get("market", ""),
        "comparables": data.get("comparables", []),
        "ranges": ranges,
        "leading_indicators": data.get("leading_indicators", []),
        "key_question": data.get("key_question", seed[:60]),
        "probability": data.get("key_question_probability", 0.5),
        "caveat": "对标片票房数据可能过期；上映后请用想看数/预售/首日排片实测数据覆盖此预测。",
    }
