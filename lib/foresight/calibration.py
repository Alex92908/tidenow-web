"""校准闭环：所有预测落库，事后判定结果，计算 Brier 分数。

没有这一层，系统就只是"生成看起来很有道理的报告"的机器。

Brier = mean((预测概率 - 实际结果)^2)，越低越好：
- 0.25 = 瞎猜（永远说50%）
- <0.20 = 有信息量
- <0.15 = 接近优秀人类预测者
"""
from __future__ import annotations

import json
import os
import time
import uuid

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "predictions.jsonl")


def log_prediction(seed: str, domain: str, question: str, probability: float, result: dict,
                   due: str | None = None) -> str:
    pid = uuid.uuid4().hex[:8]
    record = {
        "id": pid,
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
        "due": due,
        "domain": domain,
        "seed": seed[:300],
        "question": question,
        "probability": probability,
        "outcome": None,
        "resolved_ts": None,
    }
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return pid


def _load():
    if not os.path.exists(LOG_PATH):
        return []
    with open(LOG_PATH, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def resolve(pid: str, outcome: int) -> bool:
    records = _load()
    found = False
    for r in records:
        if r["id"] == pid:
            r["outcome"] = outcome
            r["resolved_ts"] = time.strftime("%Y-%m-%d %H:%M:%S")
            found = True
    if found:
        with open(LOG_PATH, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return found


def stats() -> dict:
    records = _load()
    resolved = [r for r in records if r["outcome"] is not None]
    pending = [r for r in records if r["outcome"] is None]
    out = {"total": len(records), "resolved": len(resolved), "pending": len(pending)}
    if resolved:
        brier = sum((r["probability"] - r["outcome"]) ** 2 for r in resolved) / len(resolved)
        out["brier_score"] = round(brier, 4)
        out["rating"] = ("优秀（<0.15）" if brier < 0.15 else
                         "有信息量（<0.20）" if brier < 0.20 else
                         "接近瞎猜（≥0.20，瞎猜=0.25）")
        # 分领域
        by_domain = {}
        for r in resolved:
            by_domain.setdefault(r["domain"], []).append((r["probability"] - r["outcome"]) ** 2)
        out["by_domain"] = {k: round(sum(v) / len(v), 4) for k, v in by_domain.items()}
    today = time.strftime("%Y-%m-%d")
    out["pending_list"] = [{"id": r["id"], "question": r["question"], "p": r["probability"],
                            "ts": r["ts"], "due": r.get("due"),
                            "overdue": bool(r.get("due") and r["due"] < today)}
                           for r in pending]
    out["overdue_count"] = sum(1 for p in out["pending_list"] if p["overdue"])
    return out
