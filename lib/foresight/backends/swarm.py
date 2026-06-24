"""swarm：简化版多智能体舆情仿真（MiroFish 思路的轻量实现）。

流程：
1. 从种子信息生成 N 个有差异化背景的 persona
2. 跑 R 轮仿真：每轮每个 agent 看到部分其他人的观点，更新自己的立场
3. 统计每轮立场分布 → 输出舆情演化趋势 + 最终预测

注意：LLM agent 有从众放大效应（OASIS 论文已指出），结论只能作为方向参考。
"""
from __future__ import annotations

import random
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

PERSONA_PROMPT = """根据以下事件，做两件事：

1. 提炼一个明确的"立场命题"（stance_proposition）：一句可以被"支持/反对/观望"的具体主张。
   这是关键——人群表态的对象必须清晰，避免"反对"到底反对什么含糊不清。
   例如事件是"某员工把老板比作项羽"，命题应是"这个类比恰当且正面"，而不是笼统的"对这家公司的态度"。
2. 生成 {n} 个差异化的虚拟人物画像（persona），覆盖不同年龄、职业、立场倾向，贴近真实社会构成；
   其中必须包含与事件有直接利益关系的角色（消费者、从业者、监管视角），不要全是无关路人。

只返回 JSON：
{{"stance_proposition": "一句明确的、可被支持/反对的主张",
  "personas": [{{"name": "...", "age": 30, "background": "...", "stance_bias": "..."}}]}}

事件：
{seed}
"""

AGENT_PROMPT = """你正在扮演以下人物，针对一个明确的命题表态。

人物：{persona}
事件背景：{seed}
**你要表态的命题：{proposition}**
你目前听到的其他人观点（第 {round} 轮讨论）：
{neighbors}

结合你的背景和听到的观点（你可以被说服，也可以坚持己见），针对【上述命题】给出你的立场。
立场必须是以下之一：{stances}（即：{stances} 这个命题）

只返回 JSON：{{"stance": "...", "confidence": 0.0到1.0, "comment": "一句话观点"}}
"""


def _fuzzy_stance(raw: str, stances: list) -> str:
    """容错真实 LLM 的立场写法：'强烈反对'→反对；'不支持'不得归入'支持'。"""
    for s in sorted(stances, key=len, reverse=True):
        idx = raw.find(s)
        if idx >= 0 and (idx == 0 or raw[idx - 1] not in "不非没无未"):
            return s
    return "观望" if "观望" in stances else stances[-1]


def run(llm, seed: str, n_agents: int = 12, n_rounds: int = 3,
        stances: list | None = None, verbose: bool = True) -> dict:
    stances = stances or ["支持", "反对", "观望"]

    # 1. 生成立场命题 + persona
    proposition = ""
    try:
        data = llm.chat_json([{"role": "user", "content": PERSONA_PROMPT.format(n=n_agents, seed=seed[:1500])}])
        if isinstance(data, dict):
            proposition = str(data.get("stance_proposition", "")).strip()
            personas = data.get("personas", [])
        else:
            personas = []
        personas = [p for p in personas if isinstance(p, dict)][:n_agents]
    except Exception as e:
        if verbose:
            print(f"    ! persona 生成失败（{e}），使用本地兜底画像")
        personas = []
    # 兜底命题：用种子本身，至少不会出现"反对一个未定义对象"
    if not proposition:
        proposition = f"对于「{seed[:60]}」持正面看法"
    if not personas:  # 兜底：本地生成通用画像，保证流程不中断
        bgs = ["上班族", "学生", "投资者", "媒体人", "退休人员", "个体户"]
        personas = [{"name": f"路人-{i+1}", "age": 20 + i * 5,
                     "background": bgs[i % len(bgs)], "stance_bias": "中立"}
                    for i in range(max(n_agents, 2))]
    if verbose:
        print(f"  ✓ 生成 {len(personas)} 个 persona")

    # 2. 多轮仿真
    opinions = {i: {"stance": None, "comment": ""} for i in range(len(personas))}
    history = []

    def step(i, p, r, snapshot):
        """单个 agent 的一轮发言（供线程池调用）。snapshot 为本轮开始时的观点快照。"""
        others = [j for j in snapshot if j != i and snapshot[j]["stance"] is not None]
        sample = random.sample(others, min(3, len(others)))
        neighbors = "\n".join(
            f"- {personas[j].get('name', j)}（{snapshot[j]['stance']}）：{snapshot[j]['comment']}" for j in sample
        ) or "（第一轮讨论，暂无他人观点，请基于你自己的背景独立表态）"
        try:
            resp = llm.chat_json([{"role": "user", "content": AGENT_PROMPT.format(
                persona=p, seed=seed[:1000], proposition=proposition, round=r, neighbors=neighbors,
                stances=" / ".join(stances))}], temperature=0.9)
            if not isinstance(resp, dict):
                resp = {}
            stance = str(resp.get("stance", "观望")).strip()
            if stance not in stances:
                stance = _fuzzy_stance(stance, stances)
            return i, {"stance": stance, "comment": str(resp.get("comment", ""))[:200]}
        except Exception as e:
            if verbose:
                print(f"    ! agent {i} 第 {r} 轮失败: {type(e).__name__}")
            return i, snapshot[i]

    workers = min(6, max(1, len(personas)))  # 并发上限6，避免触发 API 限流
    for r in range(1, n_rounds + 1):
        snapshot = dict(opinions)  # 同轮内大家看到同一份快照（同步更新模型）
        with ThreadPoolExecutor(max_workers=workers) as ex:
            results = ex.map(lambda args: step(*args, r, snapshot),
                             [(i, p) for i, p in enumerate(personas)])
        opinions = dict(results)
        dist = Counter(o["stance"] for o in opinions.values() if o["stance"])
        history.append({"round": r, "distribution": dict(dist)})
        if verbose:
            print(f"  ✓ 第 {r} 轮：{dict(dist)}")

    # 3. 汇总
    final = Counter(o["stance"] for o in opinions.values() if o["stance"])
    if not final:
        return {"backend": "swarm", "error": "全部 agent 调用失败，未获得任何有效立场（检查 API 连接）"}
    total = sum(final.values()) or 1
    final_pct = {k: round(v / total, 3) for k, v in final.items()}
    dominant = max(final_pct, key=final_pct.get)

    return {
        "backend": "swarm",
        "stance_subject": proposition,
        "personas": personas,
        "evolution": history,
        "final_distribution": final_pct,
        "dominant_stance": dominant,
        "probability": final_pct[dominant],
        "sample_comments": [
            f"{personas[i]['name']}（{o['stance']}）：{o['comment']}"
            for i, o in list(opinions.items())[:5]
        ],
        "caveat": "LLM 智能体存在从众放大效应，极化速度快于现实；结论仅作方向参考，置信度应打折。",
    }
