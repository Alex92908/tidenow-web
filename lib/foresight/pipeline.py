"""预测流水线：CLI 和 GUI 共用的核心入口。"""
from __future__ import annotations

import os
import time

from .llm import LLM
from . import router as router_mod, calibration, report, search
from .backends import (swarm, quant, scenario, sports, macro, trend,
                       election, boxoffice, nature, randomness, oracle, counterfactual, strange,
                       screenplay, novelist)
from .backends.common import to_prob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _pick_model(llm_cfg, key, fallback):
    """按域/角色从 cfg['models'] 取模型；无映射则用 fallback（保持单模型配置不受影响）。
    便宜任务（router）→ Haiku，重推理（scenario/oracle/strange）→ Opus，由用户在 config 里配。"""
    models = (llm_cfg or {}).get("models") or {}
    return models.get(key) or models.get("default") or fallback


def predict_once(seed: str, domain: str = "auto", symbol: str | None = None,
                 csv: str | None = None, odds: str | None = None,
                 agents: int = 12, rounds: int = 3,
                 llm_cfg: dict | None = None, mock: bool = False,
                 mode: str = "predict", chapters: int = 3,
                 on_stage=None, save_report: bool = True) -> dict:
    """执行一次完整预测。on_stage(str) 为进度回调（GUI 用）。

    mode="fiction" 时走创作模式：默认用 strange 引擎当情节生成器，
    强制 no_prediction 不污染校准。仅 strange 支持创作分支。
    """
    notify = on_stage or (lambda s: None)
    seed = (seed or "").strip()
    if not seed:
        raise ValueError("种子信息为空")
    fiction = (mode == "fiction")

    base_model = (llm_cfg or {}).get("model", "")
    llm = LLM(llm_cfg or {}, mock=mock)
    if mode == "novel":
        route = {"domain": "novel", "reason": "长篇模式：初始设定 → 故事圣经+章纲+逐章推演生成（不入校准）"}
    elif mode == "screenplay":
        route = {"domain": "screenplay", "reason": "剧本模式：故事/前提 → 剧本+分镜（供AI生成电影/漫剧，不入校准）"}
    elif fiction:
        # 创作模式只接 strange（情节生成器）；其余引擎暂不支持创作分支
        if domain not in ("strange", "auto"):
            notify(f"创作模式仅支持 strange 引擎，已忽略 --domain {domain}")
        route = {"domain": "strange", "reason": "创作模式：破局决策树当情节生成器（不入校准）"}
    elif domain == "oracle":
        route = {"domain": "oracle", "reason": "用户指定元引擎（五路独立推理+极化聚合）"}
    elif domain == "strange":
        route = {"domain": "strange", "reason": "用户指定破局搜索（决策树+对抗推演）"}
    else:
        notify("领域路由中…")
        llm.model = _pick_model(llm_cfg, "router", base_model)  # 路由用便宜模型
        route = router_mod.classify(llm, seed, forced=domain)
    d = route["domain"]
    # 后端用域对应的模型（重推理域可配 Opus，跑量域可配 Haiku/Sonnet）
    llm.model = _pick_model(llm_cfg, d, base_model)
    notify(f"路由 → {d}（{route.get('reason', '')}）")

    enriched_seed = seed
    creative = fiction or mode in ("screenplay", "novel")  # 创作模式不联网（搜索对虚构无意义且会注入噪声）
    if not llm.mock and not creative:
        notify("搜索实时信息…")
        web_context = search.search_for_seed(seed)
        if web_context:
            enriched_seed = f"{seed}\n\n{web_context}"
            notify(f"已注入 {len(web_context)} 字搜索上下文")
        else:
            notify("未获取到搜索结果，仅用种子信息")

    notify(f"运行后端 [{d}] …")
    if d == "novel":
        result = novelist.run(llm, enriched_seed, chapters=chapters, verbose=False)
        question = result.get("key_question", seed[:80])
    elif d == "screenplay":
        result = screenplay.run(llm, enriched_seed, verbose=False)
        question = result.get("key_question", seed[:80])
    elif d == "strange":
        result = strange.run(llm, enriched_seed, verbose=False, fiction=fiction)
        question = result.get("key_question", seed[:80])
    elif d == "oracle":
        result = oracle.run(llm, enriched_seed, verbose=False)
        question = result.get("key_question", seed[:80])
    elif d == "market":
        result = quant.run(llm, enriched_seed, symbol=symbol, csv=csv, verbose=False)
        question = f"该标的未来20个交易日收涨？（{symbol or csv}）"
    elif d == "opinion":
        result = swarm.run(llm, enriched_seed, n_agents=agents, n_rounds=rounds, verbose=False)
        question = f"主导立场为「{result.get('dominant_stance', '?')}」？"
    elif d == "sports":
        result = sports.run(llm, enriched_seed, odds=odds, verbose=False)
        question = result.get("key_question", seed[:80])
    elif d == "counterfactual":
        result = counterfactual.run(llm, enriched_seed, verbose=False)
        question = "（反事实推演，不产生预测）"
    elif d == "randomness":
        result = randomness.run(llm, enriched_seed, verbose=False)
        question = "（纯随机事件，不产生预测）"
    else:
        backend = {"macro": macro, "trend": trend, "election": election,
                   "boxoffice": boxoffice, "nature": nature}.get(d, scenario)
        result = backend.run(llm, enriched_seed, verbose=False)
        question = result.get("key_question", seed[:80])

    pid = None
    if not result.get("error") and not result.get("no_prediction"):
        pid = calibration.log_prediction(seed, d, question, to_prob(result.get("probability")), result)
        notify(f"预测已落库（ID: {pid}）")

    md = report.render(seed, route, result, pid)
    path = None
    if save_report:
        path = os.path.join(ROOT, "reports", f"report_{time.strftime('%Y%m%d_%H%M%S')}.md")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(md)
    return {"route": route, "result": result, "question": question,
            "pid": pid, "markdown": md, "report_path": path}
