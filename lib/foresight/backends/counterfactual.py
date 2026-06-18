"""counterfactual：反事实推演后端（历史复盘 / "如果当初" / 决策节点分析）。

方法论：
1. 把事件解构成时间线上的关键决策节点
2. 每个节点给出：实际决策 / 可行替代 / 翻转概率 P(结局显著改善|替代决策)
3. 反后见之明检查：标注该替代方案"当时可知"还是"仅后见之明"——
   只有当时可知的节点才算真正的"可挽救点"，这是本方法的诚实核心
4. 找出"最小挽救点"：时间最晚、且翻转概率仍然高的当时可知节点
5. 深层结构原因：如果所有单点翻转概率都不高，说明问题是结构性的，
   单点干预救不了——这本身就是重要结论

注意：反事实不可证伪，不写入校准日志（no_prediction=True）。
它的价值在决策复盘（投资复盘、项目失败分析、战略检讨），不在预测打分。
"""
from __future__ import annotations

from .common import safe_chat_json, to_prob

CF_PROMPT = """你是反事实推演分析师，做决策节点复盘。严格遵守反后见之明纪律：
区分"当时凭已有信息可知"与"只有事后才知道"。

事件：
{seed}

要求：
1. 给出实际结局的一句话概括
2. 按时间顺序列出 4-7 个关键决策节点，每个节点包含：
   - time：时间
   - node：节点名
   - actual：实际决策及其后果
   - alternative：当时真实存在的替代选项（必须是当事人议程上出现过或顾问提出过的，不许发明上帝视角方案）
   - knowable：「当时可知」或「仅后见之明」
   - flip_probability：若采取替代决策，最终结局显著改善的概率（0-1）
   - downstream：替代决策后的连锁变化（2-3步推演）
3. minimal_salvage_point：时间最晚、且 knowable=当时可知、且翻转概率较高的节点——即"最后的挽救窗口"，并说明为什么之后就来不及了
4. deep_cause：如果所有节点翻转概率都不高，指出结构性根因（为什么单点干预不够）；如果有高翻转节点，说明结构上为什么当事人没有选它

只返回 JSON：
{{
  "outcome": "...",
  "nodes": [
    {{"time": "...", "node": "...", "actual": "...", "alternative": "...",
      "knowable": "当时可知|仅后见之明", "flip_probability": 0.5, "downstream": "..."}}
  ],
  "minimal_salvage_point": {{"node": "...", "why": "..."}},
  "deep_cause": "..."
}}
"""


def run(llm, seed: str, verbose: bool = True) -> dict:
    data, err = safe_chat_json(llm, CF_PROMPT.format(seed=seed[:3000]), temperature=0.4)
    if err:
        return {"backend": "counterfactual", "error": err}
    nodes = data.get("nodes", []) if isinstance(data.get("nodes"), list) else []
    for n in nodes:
        n["flip_probability"] = to_prob(n.get("flip_probability"), 0.3)
    if verbose:
        for n in nodes:
            print(f"  ✓ {n.get('time','?')} {n.get('node','')} 翻转{n['flip_probability']:.0%}（{n.get('knowable','?')}）")

    return {
        "backend": "counterfactual",
        "outcome": data.get("outcome", ""),
        "nodes": nodes,
        "minimal_salvage_point": data.get("minimal_salvage_point", {}),
        "deep_cause": data.get("deep_cause", ""),
        "no_prediction": True,  # 反事实不可证伪，不入校准日志
        "caveat": "反事实推演不可证伪，翻转概率是结构化判断而非可校准预测；"
                  "其价值在于训练决策复盘能力，警惕把'仅后见之明'的方案当成当时的可选项。",
    }
