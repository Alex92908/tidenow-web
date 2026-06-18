"""oracle：元预测引擎——五条独立推理路径并发，极化对数几率聚合。

组件（每条路径都有预测科学研究背书，组合与自动化是本引擎的增量）：
  fermi      Fermi 分解 + 噪声与门（Tetlock 十诫之 "Fermi-ize"）
  debate     对抗辩论：正方/反方/法官（debate 范式）
  reference  多参照系三角化（对"选错参照类"这一最大失误源建模）
  premortem  事前验尸：双世界倒推 + 相对惊讶度
  聚合       GJP 式极化 log-odds 池化（系数1.25）+ 分歧度作为可知性信号

诚实声明：这不是魔法。它的唯一验证方式是与单方法后端在同题上对比 Brier。
oracle 预测以独立领域名落库，方便 A/B。token 消耗 ≈ 6 次调用。
"""
from __future__ import annotations

import math
import statistics
from concurrent.futures import ThreadPoolExecutor

from .common import safe_chat_json, to_prob

_CLAMP = (0.02, 0.98)
_EXTREMIZE = 1.25


def _logit(p: float) -> float:
    p = min(max(p, _CLAMP[0]), _CLAMP[1])
    return math.log(p / (1 - p))


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def noisy_and(probs: list[float], rho: float) -> float:
    """条件链合成：rho=0 独立连乘，rho=1 完全相关取min，中间几何插值。"""
    if not probs:
        return 0.5
    prod = math.prod(probs)
    mn = min(probs)
    rho = min(max(rho, 0.0), 1.0)
    return (prod ** (1 - rho)) * (mn ** rho)


def pool(probs: list[float], extremize: float = _EXTREMIZE) -> dict:
    """极化 log-odds 池化 + 分歧度。"""
    los = [_logit(p) for p in probs]
    mean_lo = sum(los) / len(los)
    disp = statistics.pstdev(los) if len(los) > 1 else 0.0
    final = _sigmoid(extremize * mean_lo)
    agreement = "高度一致" if disp < 0.5 else ("中等分歧" if disp < 1.2 else "严重分歧（此问题可能不可知，置信度应大幅打折）")
    return {"probability": round(final, 3), "dispersion": round(disp, 3), "agreement": agreement}


QUESTION_PROMPT = """把以下事件提炼成一个可明确判定真假、含时间期限的预测问题（一句话），并保留判定标准。
只返回 JSON：{{"question": "在X日期前，是否……？"}}
事件：
{seed}
"""

FERMI_PROMPT = """你是 Fermi 分解专家。把这个预测问题拆解成 3-5 个全部成立才能让事件发生的必要条件。
对每个条件给出概率，并评估条件之间的相关程度（"低"=基本独立 / "中" / "高"=一损俱损）。
只返回 JSON：{{"conditions": [{{"name": "...", "probability": 0.7}}], "correlation": "低|中|高", "note": "一句话"}}
问题：{question}
"""

DEBATE_PROMPT = """对以下预测问题进行三方推演，三个角色你都要扮演且各自全力以赴：
1. 正方律师：给出"会发生"的最强论证（最有力的3点）
2. 反方律师：给出"不会发生"的最强论证（最有力的3点）
3. 法官：权衡双方论据强度后给出最终概率，并指出哪一方的哪个论据最具决定性
只返回 JSON：{{"pro_case": ["..."], "con_case": ["..."], "judge_probability": 0.5, "decisive_argument": "..."}}
问题：{question}
"""

REFERENCE_PROMPT = """你是参照类分析师。为以下预测问题找出 3 个【彼此不同】的历史参照类，
各给出该参照类下的基率，并给每个参照类一个适用度权重（总和=1.0）。
参照类要真正不同（如：按行业类比 / 按当事方历史行为 / 按事件结构类比），不许换皮重复。
只返回 JSON：{{"classes": [{{"name": "...", "base_rate": 0.3, "weight": 0.4, "why": "..."}}]}}
问题：{question}
"""

PREMORTEM_PROMPT = """事前验尸法。对以下预测问题：
1. 假设事件【已经发生】，倒推出最可能的因果链（3步），并评估这条链的离奇程度 surprise_if_yes（0=毫不意外，1=极度离奇）
2. 假设事件【没有发生】，同样倒推因果链并评估 surprise_if_no
注意：两个惊讶度是独立评估，不要求互补。
只返回 JSON：{{"path_to_yes": ["..."], "surprise_if_yes": 0.4, "path_to_no": ["..."], "surprise_if_no": 0.5}}
问题：{question}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    # 0. 统一问题（保证五条路径回答同一件事）
    q, err = safe_chat_json(llm, QUESTION_PROMPT.format(seed=seed[:2000]), temperature=0.1)
    if err:
        return {"backend": "oracle", "error": err}
    question = q.get("question") or seed[:100]
    if verbose:
        print(f"  ✓ 核心问题：{question}")

    # 1. 四条路径并发
    def _fermi():
        d, e = safe_chat_json(llm, FERMI_PROMPT.format(question=question), temperature=0.3)
        if e or not isinstance(d.get("conditions"), list) or not d["conditions"]:
            return None
        probs = [to_prob(c.get("probability"), 0.5) for c in d["conditions"]]
        rho = {"低": 0.0, "中": 0.5, "高": 0.9}.get(str(d.get("correlation", "中")), 0.5)
        return {"method": "Fermi分解", "probability": round(noisy_and(probs, rho), 3),
                "detail": "；".join(f"{c.get('name','')}({to_prob(c.get('probability'),0.5):.0%})" for c in d["conditions"])
                          + f"｜相关度:{d.get('correlation','中')}"}

    def _debate():
        d, e = safe_chat_json(llm, DEBATE_PROMPT.format(question=question), temperature=0.5)
        if e:
            return None
        return {"method": "对抗辩论", "probability": to_prob(d.get("judge_probability")),
                "detail": f"决定性论据：{d.get('decisive_argument','')}"}

    def _reference():
        d, e = safe_chat_json(llm, REFERENCE_PROMPT.format(question=question), temperature=0.3)
        if e or not isinstance(d.get("classes"), list) or not d["classes"]:
            return None
        cls = d["classes"]
        wsum = sum(to_prob(c.get("weight"), 0) for c in cls) or 1
        p = sum(to_prob(c.get("base_rate"), 0.5) * to_prob(c.get("weight"), 0) for c in cls) / wsum
        return {"method": "多参照系", "probability": round(p, 3),
                "detail": "；".join(f"{c.get('name','')}({to_prob(c.get('base_rate'),0.5):.0%})" for c in cls)}

    def _premortem():
        d, e = safe_chat_json(llm, PREMORTEM_PROMPT.format(question=question), temperature=0.5)
        if e:
            return None
        sy = to_prob(d.get("surprise_if_yes"), 0.5)
        sn = to_prob(d.get("surprise_if_no"), 0.5)
        # 相对惊讶度→概率：发生越不离奇、不发生越离奇，概率越高
        p = (1 - sy) / max((1 - sy) + (1 - sn), 1e-6)
        return {"method": "事前验尸", "probability": round(p, 3),
                "detail": f"发生离奇度{sy:.0%} vs 不发生离奇度{sn:.0%}"}

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(f) for f in (_fermi, _debate, _reference, _premortem)]
        estimates = [f.result() for f in futures]
    estimates = [e for e in estimates if e]

    if len(estimates) < 2:
        return {"backend": "oracle", "error": f"五路推理只有 {len(estimates)} 路成功，不足以聚合（至少需要2路）"}
    if verbose:
        for e in estimates:
            print(f"  ✓ {e['method']}: {e['probability']:.0%}")

    # 2. 极化聚合
    agg = pool([e["probability"] for e in estimates])
    if verbose:
        print(f"  ✓ 聚合：{agg['probability']:.0%}（分歧度 {agg['dispersion']}，{agg['agreement']}）")

    return {
        "backend": "oracle",
        "key_question": question,
        "estimates": estimates,
        "probability": agg["probability"],
        "dispersion": agg["dispersion"],
        "agreement": agg["agreement"],
        "caveat": "元引擎不是魔法：它的价值必须通过与单方法后端同题对比 Brier 来证明；"
                  "各路径共享同一个底层模型，独立性弱于真实人类群体，极化系数已保守取1.25。",
    }
