"""novelist：长篇小说编排器。初始设定 → 故事圣经 → 全书章纲 → 逐章「推演+生成+记账」。

长篇的死穴是漂移（写到后面失忆、人物变脸、伏笔不收、注水重复）。本引擎用三件事对抗它：
1. 故事圣经（脊柱）：核心冲突引擎 + 胜利条件 + 结构性宿命 + 主题，全程不变，防失忆
2. 状态账本（ledger）：每写完一章结构化更新"谁在哪/知道什么/关系/伏笔"，喂下一章，防矛盾
3. 逐章推演（predictive）：写每章前先推演"以当前状态各角色最可能怎么动、戏剧上最该发生什么"，
   复用预测域的对抗/多视角推理，保证因果咬合、张力递增，而非随机注水

创作产物，强制 no_prediction，不入 Brier 校准。
"""
from __future__ import annotations

from .common import safe_chat_json

BIBLE_PROMPT = """你是长篇小说总策划。基于下面的初始设定，产出一份"故事圣经"作为全书脊柱。
要求提炼：核心冲突引擎（驱动全书的那个不可解矛盾）、主角们的胜利条件、结构性宿命
（他们最高只能到哪一步——这是主题所在）、一句话主题、3-6 个 POV 角色（姓名/身份/各自的弧光）。

初始设定：
{seed}

只返回 JSON：
{{"title": "...", "logline": "...", "world": "世界观与时代基调",
  "conflict_engine": "驱动全书的核心矛盾", "win_condition": "主角们要达成什么",
  "structural_ceiling": "他们最高只能到哪一步（主题）", "theme": "一句话主题",
  "pov_characters": [{{"name": "...", "role": "身份", "arc": "这个人物的内在弧光"}}]}}
"""

OUTLINE_PROMPT = """你是长篇小说结构师。基于故事圣经，规划全书分幕分章大纲。
要求：分 3-4 幕，每幕若干章；每章给：章号、标题、本章 POV、节拍目标（这一章推进什么）、
转折（本章的小高潮/翻转）、涉及的伏笔（埋或收）。总章数 12-20，节奏完整（建置→纠葛→至暗→收束）。

故事圣经：
{bible}

只返回 JSON：
{{"acts": [{{"act": 1, "title": "幕名"}}],
  "chapters": [
    {{"chapter": 1, "act": 1, "title": "章名", "pov": "本章视角人物",
      "beat": "节拍目标", "turn": "本章转折", "threads": ["涉及的伏笔/线索"]}}
  ]}}
"""

NEXT_PROMPT = """你是长篇小说的"推演师"。在动笔写第 {ch_no} 章之前，先做一次因果推演，
保证这一章是"必然发生"而非随机注水。

故事圣经（脊柱，不可违背）：{bible}
当前状态账本（截至上一章末）：{ledger}
本章大纲：{chapter}

推演：
1. 以当前状态，本章每个在场角色最可能怎么行动？为什么（动机要从账本里的处境长出来）
2. 戏剧上这一章最该发生的那个转折是什么？它如何为后面埋下因果
3. 本章要收哪个旧伏笔、埋哪个新伏笔
4. 本章的情绪基调与结尾留给读者的那口气

只返回 JSON：
{{"character_moves": [{{"who": "...", "does": "...", "why": "..."}}],
  "key_turn": "本章核心转折", "foreshadow": {{"pay_off": "收的伏笔", "plant": "埋的伏笔"}},
  "tone": "情绪基调", "ending_beat": "结尾那口气"}}
"""

CHAPTER_PROMPT = """你是一位文笔出色的长篇小说家。请写出第 {ch_no} 章《{title}》的完整正文。

故事圣经（脊柱）：{bible}
当前状态账本（确保与之不矛盾）：{ledger}
本章大纲：{chapter}
本章推演（按它来写，保证因果与转折）：{prediction}

写作要求：
- 1500-2500 字，{pov} 的视角，场景具体、有质感、对白克制有力
- 推进节拍目标、落实那个转折，按推演收埋伏笔
- 不要复述前情，不要议论拔高；用细节和动作说话
- 结尾落在推演给的那口气上

直接输出正文（不要 JSON，不要标题，不要任何说明）：
"""

LEDGER_PROMPT = """你是长篇小说的连贯性管理员。读完刚写好的这一章，更新"状态账本"，供下一章使用。
账本要客观、结构化，只记事实状态，不评价。

上一版账本：{ledger}
刚写好的第 {ch_no} 章正文：
{prose}

只返回 JSON（在旧账本基础上增量更新）：
{{"timeline": "故事推进到的时间点", "locations": {{"角色名": "当前所在"}},
  "knows": {{"角色名": "该角色目前知道的关键信息"}},
  "relationships": "关键关系的当前状态",
  "open_threads": ["尚未收束的伏笔/悬念"], "closed_threads": ["本章已收的伏笔"],
  "emotional_state": {{"角色名": "当前情绪/处境"}}}}
"""


def run(llm, seed: str, chapters: int = 3, verbose: bool = True) -> dict:
    import json as _j
    bible, err = safe_chat_json(llm, BIBLE_PROMPT.format(seed=seed[:4000]), temperature=0.5)
    if err:
        return {"backend": "novelist", "error": err}
    bible_s = _j.dumps(bible, ensure_ascii=False)
    if verbose:
        print(f"  ✓ 故事圣经：《{bible.get('title','')}》主题：{bible.get('theme','')[:30]}")

    outline, err = safe_chat_json(llm, OUTLINE_PROMPT.format(bible=bible_s[:3000]), temperature=0.4)
    if err:
        return {"backend": "novelist", "error": err, "bible": bible}
    ch_list = outline.get("chapters", []) if isinstance(outline.get("chapters"), list) else []
    if not ch_list:
        return {"backend": "novelist", "error": "结构师未能排出章纲", "bible": bible}
    if verbose:
        print(f"  ✓ 全书章纲：{len(ch_list)} 章，本次生成前 {min(chapters, len(ch_list))} 章正文")

    ledger = {}
    written = []
    for ch in ch_list[:max(0, chapters)]:
        ch_s = _j.dumps(ch, ensure_ascii=False)
        ledger_s = _j.dumps(ledger, ensure_ascii=False) if ledger else "（开篇，暂无）"
        ch_no = ch.get("chapter", len(written) + 1)
        title = ch.get("title", "")
        pov = ch.get("pov", "")

        pred, e = safe_chat_json(llm, NEXT_PROMPT.format(
            ch_no=ch_no, bible=bible_s[:2000], ledger=ledger_s[:2500], chapter=ch_s), temperature=0.5)
        pred_s = _j.dumps(pred, ensure_ascii=False) if not e else "（推演不可用，按大纲直接写）"

        try:
            prose = llm.chat([{"role": "user", "content": CHAPTER_PROMPT.format(
                ch_no=ch_no, title=title, pov=pov, bible=bible_s[:2000],
                ledger=ledger_s[:2500], chapter=ch_s, prediction=pred_s)}], temperature=0.7)
        except Exception as ex:
            prose = f"（第 {ch_no} 章生成失败：{ex}）"
        written.append({"chapter": ch_no, "title": title, "pov": pov, "prose": prose})
        if verbose:
            print(f"  ✓ 第 {ch_no} 章《{title}》{len(prose)} 字")

        new_ledger, e = safe_chat_json(llm, LEDGER_PROMPT.format(
            ch_no=ch_no, ledger=ledger_s[:2000], prose=prose[:4000]), temperature=0.2)
        if not e and isinstance(new_ledger, dict):
            ledger = new_ledger

    return {
        "backend": "novelist",
        "no_prediction": True,
        "title": bible.get("title", ""),
        "logline": bible.get("logline", ""),
        "bible": bible,
        "acts": outline.get("acts", []),
        "outline": ch_list,
        "chapters": written,
        "ledger": ledger,
        "key_question": f"长篇《{bible.get('title','')}》共 {len(ch_list)} 章规划，已成稿 {len(written)} 章",
        "caveat": "长篇创作产物：故事圣经+章纲是全书脊柱，状态账本支持一章章续写（把 ledger 喂回即可接着写）。"
                  "不可证伪，不入 Brier 校准。长篇连贯性高度依赖模型能力，建议用 Opus 级模型续写。",
    }
