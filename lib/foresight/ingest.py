"""ingest：热榜聚合站 → ForeSight 自动化通道。

数据源：任意提供公开 JSON 热榜 API 的聚合站（推荐 CORS 全开、无需鉴权）
    GET {BASE}/{source_id}  →  {"items": [{"title", "url", "extra"...}]}
    BASE 由环境变量 FORESIGHT_INGEST_BASE 配置（默认值见下方常量）。

流程：
  抓取 N 个源的热榜 → LLM 筛选"值得预测"的条目（过滤纯八卦/旧闻/不可判定话题）
  → 逐条走 pipeline.predict_once → 汇总摘要 → 可选 Feishu webhook 推送

定时：crontab 例（每天 9 点）：
  0 9 * * * cd /path/to/foresight && python3 main.py ingest --top 5 --push
"""
from __future__ import annotations

import json
import os
import time

import requests

from .pipeline import predict_once
from .llm import LLM

# 热榜聚合站 JSON API 基址，可用环境变量覆盖（示例值为一个 CORS 全开的公开聚合站）
TIDENOW_BASE = os.environ.get("FORESIGHT_INGEST_BASE", "https://tide-now.com/api/sources")
# 默认抓的源：偏新闻/财经/科技（可在 config.yaml ingest.sources 覆盖）
DEFAULT_SOURCES = ["weibo", "zhihu", "36kr", "wallstreetcn", "cls", "ithome", "hackernews", "thepaper"]

PICK_PROMPT = """你是预测任务筛选器。以下是今日热榜条目，从中挑出最多 {n} 条"值得做预测"的：
- 值得：有未来走向可言、可判定（政策动向、公司事件、产品发布、市场异动、赛事、舆情发酵中）
- 不值得：纯八卦花边、已成定局的旧闻、情绪话题、无法判定真假的口水仗

条目：
{items}

只返回 JSON：{{"picks": [{{"index": 3, "reason": "一句话"}}]}}
"""


def fetch_source(source_id: str, timeout: int = 15, fetcher=None) -> list[dict]:
    """抓取单个热榜源。fetcher 可注入（测试用）。"""
    if fetcher:
        return fetcher(source_id)
    resp = requests.get(f"{TIDENOW_BASE}/{source_id}", timeout=timeout,
                        headers={"User-Agent": "foresight-ingest/1.0"})
    resp.raise_for_status()
    data = resp.json()
    items = data.get("items", data if isinstance(data, list) else [])
    return [{"source": source_id, "title": it.get("title", ""), "url": it.get("url", ""),
             "extra": it.get("extra", "")} for it in items if it.get("title")]


def gather(sources: list[str] | None = None, per_source: int = 10, fetcher=None,
           on_stage=None) -> list[dict]:
    notify = on_stage or (lambda s: None)
    all_items = []
    for sid in (sources or DEFAULT_SOURCES):
        try:
            items = fetch_source(sid, fetcher=fetcher)[:per_source]
            all_items.extend(items)
            notify(f"{sid}: {len(items)} 条")
        except Exception as e:
            notify(f"{sid}: 抓取失败 {type(e).__name__}")
    # 去重（同标题）
    seen, dedup = set(), []
    for it in all_items:
        key = it["title"][:30]
        if key not in seen:
            seen.add(key)
            dedup.append(it)
    return dedup


def pick(llm, items: list[dict], top: int = 5) -> list[dict]:
    """LLM 筛选值得预测的条目；失败时退化为取前 top 条。"""
    listing = "\n".join(f"{i}. [{it['source']}] {it['title']} {it.get('extra','')}"
                        for i, it in enumerate(items[:80]))
    try:
        data = llm.chat_json([{"role": "user", "content": PICK_PROMPT.format(n=top, items=listing)}],
                             temperature=0.2)
        picks = data.get("picks", [])
        chosen = []
        for p in picks[:top]:
            idx = int(p.get("index", -1))
            if 0 <= idx < len(items):
                items[idx]["pick_reason"] = p.get("reason", "")
                chosen.append(items[idx])
        if chosen:
            return chosen
    except Exception:
        pass
    return items[:top]


def push_feishu(webhook: str, text: str) -> bool:
    try:
        resp = requests.post(webhook, json={"msg_type": "text", "content": {"text": text[:9000]}},
                             timeout=10)
        return resp.status_code == 200
    except Exception:
        return False


def run_ingest(cfg: dict, top: int = 5, sources: list[str] | None = None,
               mock: bool = False, push: bool = False, fetcher=None,
               on_stage=None) -> dict:
    notify = on_stage or print
    llm_cfg = cfg.get("llm", {})
    ingest_cfg = cfg.get("ingest", {}) or {}
    sources = sources or ingest_cfg.get("sources") or DEFAULT_SOURCES

    notify("① 抓取热榜聚合站…")
    items = gather(sources, fetcher=fetcher, on_stage=lambda s: notify("   " + s))
    if not items:
        return {"error": "未抓到任何条目（检查网络或源列表）"}
    notify(f"   共 {len(items)} 条（去重后）")

    notify(f"② 筛选 top{top} 可预测条目…")
    llm = LLM(llm_cfg, mock=mock)
    chosen = pick(llm, items, top=top)
    for c in chosen:
        notify(f"   ✦ [{c['source']}] {c['title']}（{c.get('pick_reason','')}）")

    notify("③ 逐条预测…")
    digest, results = [], []
    for c in chosen:
        seed = f"{c['title']}。{c.get('extra','')}（来源：{c['source']}）"
        try:
            out = predict_once(seed, domain="auto", llm_cfg=llm_cfg, mock=mock)
            r, q = out["result"], out["question"]
            p = r.get("probability")
            line = (f"[{out['route']['domain']}] {c['title']}\n"
                    f"  问题：{q}\n  概率：{p:.0%}（ID {out['pid']}）" if out["pid"]
                    else f"[{out['route']['domain']}] {c['title']}\n  （不产生可校准预测）")
            digest.append(line)
            results.append(out)
            notify(f"   ✓ {c['title'][:24]} → {out['route']['domain']}")
        except Exception as e:
            digest.append(f"[失败] {c['title']}：{type(e).__name__}")
            notify(f"   ✗ {c['title'][:24]}：{e}")

    header = f"📡 ForeSight 每日预测 {time.strftime('%Y-%m-%d %H:%M')}\n" + "—" * 24 + "\n"
    text = header + "\n\n".join(digest) + "\n\n（到期后记得 resolve 判定，校准闭环才有意义）"

    if push:
        webhook = ingest_cfg.get("feishu_webhook") or os.environ.get("FORESIGHT_FEISHU_WEBHOOK", "")
        if webhook:
            ok = push_feishu(webhook, text)
            notify("④ Feishu 推送：" + ("成功" if ok else "失败"))
        else:
            notify("④ 未配置 feishu_webhook（config.yaml ingest 段或环境变量），跳过推送")

    notify("\n" + text)
    return {"items_fetched": len(items), "predicted": len(results), "digest": text}
