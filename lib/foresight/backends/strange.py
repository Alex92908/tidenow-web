"""strange：破局搜索引擎（"奇异博士模式"）。

与 counterfactual（向后复盘）相反：向前搜索决策树，找出胜率最高的那条路径。
诚实声明：不是模拟 1400 万个未来，而是结构化采样决策树——
而且"最优路径胜率也很低"本身就是合法答案（电影里 1/14000605 的本质）。

流程（3 类调用，分支推演并发）：
1. 架构师：定义胜利条件 + 枚举 3-5 条战略分支（含史实/现状路径作基线）
2. 对抗推演员（每分支并发）：世界/对手的最强反制 → P(胜利|该分支) + 致命脆弱点
3. 评估官：比较所有分支，允许提出混合路径，给出"唯一最优破局方案"与裁决：
   破局可行(>40%) / 低概率破局(15-40%) / 接近无解(<15%)
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from .common import safe_chat_json, to_prob

ARCHITECT_PROMPT = """你是破局架构师。针对以下局面：
1. 明确定义"胜利条件"（可判定的目标状态）
2. 枚举 3-5 条互斥的战略分支，必须包含"实际采取/默认延续"的路径作为基线
3. 每条分支给出初步成功概率

局面：
{seed}

只返回 JSON：
{{"win_condition": "...", "branches": [{{"name": "...", "description": "...", "p_initial": 0.2, "is_baseline": false}}]}}
"""

ADVERSARY_PROMPT = """你是对抗推演员，立场是"让这条路径失败"。
胜利条件：{win}
待推演分支：{branch}（{desc}）

1. 给出世界/对手对这条路径的最强反制
2. 在考虑反制后，给出 P(达成胜利条件 | 走这条分支) 的最终概率
3. 指出这条路径最致命的单点脆弱处

只返回 JSON：{{"counter_move": "...", "p_win": 0.15, "fatal_weakness": "..."}}
"""

JUDGE_PROMPT = """你是最终评估官。胜利条件：{win}
各分支推演结果：
{results}

1. 选出胜率最高的路径；如果组合两条分支能产生更优的混合路径，明确给出混合方案及其概率（混合概率必须有依据，不许凭空高于组成部分太多）
2. 裁决：破局可行(>0.4) / 低概率破局(0.15-0.4) / 接近无解(<0.15)
3. 解释结构性约束：为什么天花板就在这里
4. 给出可判定的核心问题

只返回 JSON：
{{"best_path": "...", "p_win": 0.15, "is_hybrid": false, "verdict": "...",
  "structural_ceiling": "...", "why_others_fail": "...",
  "key_question": "在X期限内是否达成……？"}}
"""

# ---------- 创作模式（fiction）：把破局推演当情节生成器 ----------
# 决策树天生是情节骨架：分支=情节线、对抗反制=戏剧冲突、脆弱点=角色命门。
# 创作不可证伪，结果强制 no_prediction，不入校准。
ARCHITECT_PROMPT_FICTION = """你是破局架构师，同时是一位擅长高智商博弈情节的小说家。针对以下故事困局：
1. 明确定义主角的"胜利条件"（一个具体、可被读者认同的目标状态）
2. 枚举 3-5 条互斥的破局路径，每条都是一条潜在情节线，必须包含一条"最显而易见、读者预期主角会走"的路径作为基线
3. 每条路径给出"戏剧张力强度"（0-1，越高越扣人心弦，对应 p_initial）

故事困局：
{seed}

只返回 JSON：
{{"win_condition": "...", "branches": [{{"name": "情节线名", "description": "这条线如何展开", "p_initial": 0.3, "is_baseline": false}}]}}
"""

ADVERSARY_PROMPT_FICTION = """你是对抗推演员兼反派塑造者，立场是"让主角这条路走向危机"。
胜利条件：{win}
待推演情节线：{branch}（{desc}）

1. 给出敌对力量/反派对这条情节线的最强反击（一个具体的、令人意外的转折）
2. 在反击之后，给出"这条线最终让主角达成目标"的戏剧合理度（0-1，对应 p_win，越低越悲剧/越需要代价）
3. 指出主角在这条线上最致命的命门（性格缺陷或处境软肋——好故事的钩子）

只返回 JSON：{{"counter_move": "...", "p_win": 0.3, "fatal_weakness": "..."}}
"""

JUDGE_PROMPT_FICTION = """你是最终评估官兼总编。胜利条件：{win}
各情节线推演结果：
{results}

1. 选出最有故事价值的主线；如果交织两条线能产生更精彩的复合结构，明确给出复合方案
2. 裁决这个故事的基调：逆袭爽文(>0.4) / 惨胜悲壮(0.15-0.4) / 注定的悲剧(<0.15)
3. 解释这个故事的"结构性宿命"：为什么主角最高只能走到这一步——这正是主题所在
4. 给出一句话的故事内核（不是预测问题，是主题句）

只返回 JSON：
{{"best_path": "...", "p_win": 0.3, "is_hybrid": false, "verdict": "...",
  "structural_ceiling": "...", "why_others_fail": "...",
  "key_question": "这个故事的内核：……"}}
"""


def run(llm, seed: str, verbose: bool = True, fiction: bool = False) -> dict:
    # 创作模式切换整套 prompt；其余推演逻辑（并发、概率封顶、裁决）完全复用
    arch_p = ARCHITECT_PROMPT_FICTION if fiction else ARCHITECT_PROMPT
    adv_p = ADVERSARY_PROMPT_FICTION if fiction else ADVERSARY_PROMPT
    judge_p = JUDGE_PROMPT_FICTION if fiction else JUDGE_PROMPT

    arch, err = safe_chat_json(llm, arch_p.format(seed=seed[:2500]), temperature=0.4)
    if err:
        return {"backend": "strange", "error": err}
    win = arch.get("win_condition", "")
    branches = arch.get("branches", []) if isinstance(arch.get("branches"), list) else []
    if not branches:
        return {"backend": "strange", "error": "架构师未能枚举出战略分支"}
    if verbose:
        print(f"  ✓ 胜利条件：{win}；{len(branches)} 条分支")

    def _probe(b):
        d, e = safe_chat_json(llm, adv_p.format(
            win=win, branch=b.get("name", ""), desc=b.get("description", "")), temperature=0.5)
        if e:
            return None
        return {"name": b.get("name", ""), "description": b.get("description", ""),
                "is_baseline": bool(b.get("is_baseline")),
                "p_initial": to_prob(b.get("p_initial")),
                "counter_move": d.get("counter_move", ""),
                "p_win": to_prob(d.get("p_win")),
                "fatal_weakness": d.get("fatal_weakness", "")}

    with ThreadPoolExecutor(max_workers=4) as ex:
        probed = [r for r in ex.map(_probe, branches) if r]
    if len(probed) < 2:
        return {"backend": "strange", "error": f"分支推演只有 {len(probed)} 条成功，不足以比较"}
    probed.sort(key=lambda x: x["p_win"], reverse=True)
    if verbose:
        for p in probed:
            print(f"  ✓ {p['name']}: P(win)={p['p_win']:.0%}")

    results_text = "\n".join(
        f"- {p['name']}{'（基线）' if p['is_baseline'] else ''}: P={p['p_win']:.2f}；"
        f"反制：{p['counter_move']}；脆弱点：{p['fatal_weakness']}" for p in probed)
    judge, err = safe_chat_json(llm, judge_p.format(win=win, results=results_text), temperature=0.3)
    if err:
        return {"backend": "strange", "error": err}

    p_win = to_prob(judge.get("p_win"))
    # 防御：混合路径概率不得超过最优单分支的 1.5 倍（防止评估官凭空乐观）
    best_single = probed[0]["p_win"]
    if judge.get("is_hybrid") and p_win > min(best_single * 1.5, best_single + 0.15):
        p_win = round(min(best_single * 1.5, best_single + 0.15), 3)

    if fiction:
        verdict = judge.get("verdict") or ("逆袭爽文" if p_win > 0.4 else "惨胜悲壮" if p_win >= 0.15 else "注定的悲剧")
    else:
        verdict = judge.get("verdict") or ("破局可行" if p_win > 0.4 else "低概率破局" if p_win >= 0.15 else "接近无解")
    if verbose:
        label = "故事基调" if fiction else "最优路径"
        print(f"  ✓ {label}：{judge.get('best_path','')}（{p_win:.0%}，{verdict}）")

    result = {
        "backend": "strange",
        "fiction": fiction,
        "win_condition": win,
        "branches": probed,
        "best_path": judge.get("best_path", probed[0]["name"]),
        "is_hybrid": bool(judge.get("is_hybrid")),
        "probability": p_win,
        "verdict": verdict,
        "structural_ceiling": judge.get("structural_ceiling", ""),
        "why_others_fail": judge.get("why_others_fail", ""),
        "key_question": judge.get("key_question", seed[:80]),
        "caveat": "这是结构化采样的决策树，不是 1400 万次模拟；'最优路径胜率很低'是合法且常见的答案。"
                  "用于历史局面时不可证伪，用于进行中事务时请事后 resolve 校准。",
    }
    if fiction:
        # 创作输出不可证伪，强制隔离校准（符合校准隔离纪律）
        result["no_prediction"] = True
        result["caveat"] = ("创作模式：这是把破局决策树当情节生成器的产物——分支是情节线、"
                            "对抗反制是戏剧冲突、致命脆弱点是角色命门。不可证伪，不入 Brier 校准。")
    return result
