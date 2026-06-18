"""screenplay：把故事/前提改编成「剧本 + 分镜」，供 AI 生成电影 / 漫剧使用。

两阶段（与 strange 同源的并发结构）：
1. 编剧：故事 → logline + 统一视觉风格 + 角色设定 + 分场剧本（场景标题/动作/对白）
2. 分镜师（每场并发）：一场戏 → 逐镜头分镜（景别/机位/运镜/时长/画面/声音/AI 生成提示词）

创作产物不可证伪，强制 no_prediction，不入 Brier 校准。
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from .common import safe_chat_json

SCREENPLAY_PROMPT = """你是资深编剧。把下面的故事 / 前提改编成可拍摄的剧本结构。
要求：
1. 提炼一句话 logline 与「整体视觉风格」（色调/质感/参考美学，用于统一后续 AI 生成画风）
2. 列出主要角色及其外形锚点（供 AI 生成时保持形象一致）
3. 拆成若干场（scene），每场给：场景标题（内/外 - 地点 - 时间）、本场要点、动作场面描述、对白
4. 控制在 4-8 场，节奏完整（建置→冲突→至暗→转折→收束）

故事 / 前提：
{seed}

只返回 JSON：
{{"title": "...", "logline": "...", "style": "...",
  "characters": [{{"name": "...", "look": "外形/气质锚点"}}],
  "scenes": [
    {{"scene_no": 1, "heading": "内/外 - 地点 - 时间", "synopsis": "本场要点",
      "action": "动作场面描述", "dialogue": [{{"character": "...", "parenthetical": "(语气提示)", "line": "台词"}}]}}
  ]}}
"""

STORYBOARD_PROMPT = """你是分镜师，要把下面这一场戏拆成可直接喂给 AI 图像 / 视频生成的逐镜头分镜。
整体画风（务必让每个镜头的提示词都贴合它）：{style}

场景标题：{heading}
本场要点：{synopsis}
动作：{action}
对白：{dialogue}

要求每个镜头给出：
- shot_no 镜号（如 1A/1B）
- size 景别（大全景/全景/中景/近景/特写/大特写）
- angle 机位角度（平视/俯拍/仰拍/过肩/主观视角等）
- movement 运镜（固定/缓推/横移/跟拍/升降等）
- duration_sec 预估时长（秒）
- description 画面内容（一句话说清这一格画面）
- audio 声音设计（旁白/对白/音效/配乐，注明）
- image_prompt 给 AI 的生成提示词（中英结合、具体到光线构图，可直接喂 Midjourney/可灵/Sora）
镜头数 3-6 个，覆盖本场叙事。

只返回 JSON：
{{"shots": [
  {{"shot_no": "1A", "size": "...", "angle": "...", "movement": "...", "duration_sec": 4,
    "description": "...", "audio": "...", "image_prompt": "..."}}
]}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    script, err = safe_chat_json(llm, SCREENPLAY_PROMPT.format(seed=seed[:4000]), temperature=0.5)
    if err:
        return {"backend": "screenplay", "error": err}
    scenes = script.get("scenes", []) if isinstance(script.get("scenes"), list) else []
    if not scenes:
        return {"backend": "screenplay", "error": "编剧未能拆出任何场景"}
    style = script.get("style", "")
    if verbose:
        print(f"  ✓ 《{script.get('title','')}》{len(scenes)} 场，画风：{style[:30]}")

    def _board(sc):
        dlg = "；".join(f"{d.get('character','')}：{d.get('line','')}" for d in sc.get("dialogue", []) or [])
        d, e = safe_chat_json(llm, STORYBOARD_PROMPT.format(
            style=style, heading=sc.get("heading", ""), synopsis=sc.get("synopsis", ""),
            action=sc.get("action", ""), dialogue=dlg or "（无对白）"), temperature=0.4)
        shots = (d or {}).get("shots", []) if not e else []
        sc = dict(sc)
        sc["shots"] = shots if isinstance(shots, list) else []
        return sc

    with ThreadPoolExecutor(max_workers=4) as ex:
        boarded = list(ex.map(_board, scenes))
    boarded.sort(key=lambda s: s.get("scene_no", 0))
    total_shots = sum(len(s.get("shots", [])) for s in boarded)
    if verbose:
        print(f"  ✓ 分镜完成：{total_shots} 个镜头")

    return {
        "backend": "screenplay",
        "no_prediction": True,  # 创作产物，隔离校准
        "title": script.get("title", ""),
        "logline": script.get("logline", ""),
        "style": style,
        "characters": script.get("characters", []) if isinstance(script.get("characters"), list) else [],
        "scenes": boarded,
        "total_shots": total_shots,
        "key_question": f"剧本《{script.get('title','')}》共 {len(boarded)} 场 {total_shots} 镜",
        "caveat": "创作产物：剧本+分镜供 AI 生成电影/漫剧参考；不可证伪，不入 Brier 校准。"
                  "image_prompt 可直接喂图像/视频生成模型，建议固定 seed 与角色锚点以保持画面连贯。",
    }
