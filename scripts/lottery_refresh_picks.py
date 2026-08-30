#!/usr/bin/env python3
"""轻量刷新：只重算推荐号码与盲区，不跑置换检验。

为什么单独做这个：
  推荐号码 = 各方法跑一遍取 TopN，毫秒级，且**每期新数据都会变**；
  p 值     = 2000 次置换 × 16 方法 × 多种子，1-2 小时，而几期新数据
             只会改动第三位小数。
两者成本差三个数量级，绑在一起跑等于为了刷新一个每天都变的数字，
每天烧一两小时算力去重算一个不变的数字。

所以本脚本只更新 next_pick / never_picked / 最新期号，
p 值沿用上一次完整分析的结果，并标注它是哪天算的——
让人一眼看出"推荐是新的，显著性是那天的"。
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 本仓库的 foresight 包在 lib/ 下（vendored 副本），数据在 src/data/lottery/
sys.path.insert(0, os.path.join(ROOT, "lib"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import dlt_engine as E                     # noqa: E402
from foresight import lottery as L         # noqa: E402


def refresh(json_path: str) -> dict:
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    for gid, g in data.get("games", {}).items():
        rows = L.load_csv(gid)
        if not rows:
            continue
        g["n"] = len(rows)
        g["last"] = rows[-1]["期号"]
        g["last_date"] = rows[-1]["日期"]
        keys = [k for k in L.fields(gid)[2:] if k not in ("和值", "跨度")]
        g["recent"] = [{"期号": r["期号"], "日期": r["日期"],
                        "nums": [r[k] for k in keys]} for r in rows[-30:][::-1]]

        if g["kind"] == "set":
            spec = L.GAMES[gid]
            for (zname, zmax, zn), pick in zip(spec["zones"], spec["picks"]):
                z = g["zones"].get(zname)
                if not z:
                    continue
                M = E.to_matrix(rows, [f"{zname}{i+1}" for i in range(zn)], zmax)
                # 多加一行虚拟期，让"最后一行"代表下一期的评分
                M2 = np.vstack([M, np.zeros((1, zmax), dtype=M.dtype)])
                mats = {n: f(M2) for n, f in E.METHODS.items()}
                mats.update(E.build_all_fusions(mats, M2, pick, max(200, int(len(rows) * 0.25))))
                picked = set()
                for m in z["methods"]:
                    S = mats.get(m["name"])
                    if S is None:
                        continue
                    m["next_pick"] = sorted((np.argsort(-S[-1])[:pick] + 1).tolist())
                    picked |= set(m["next_pick"])
                z["never_picked"] = sorted(set(range(1, zmax + 1)) - picked)
        else:
            bt = g.get("backtest")
            if not bt:
                continue
            D = E.digit_matrix(rows, g["digits"])
            for pos in bt["positions"]:
                i = pos["pos"] - 1
                M = np.zeros((len(rows), 10), dtype=np.uint8)
                M[np.arange(len(rows)), D[:, i]] = 1
                M2 = np.vstack([M, np.zeros((1, 10), dtype=M.dtype)])
                mats = {n: f(M2) for n, f in E.METHODS.items()}
                mats["fuse_equal"] = E.build_all_fusions(
                    mats, M2, bt["pick"], max(200, int(len(rows) * 0.25)))["fuse_equal"]
                picked = set()
                for m in pos["methods"]:
                    S = mats.get(m["name"])
                    if S is None:
                        continue
                    m["next_pick"] = np.argsort(-S[-1])[:bt["pick"]].tolist()
                    picked |= set(m["next_pick"])
                pos["never_picked"] = sorted(set(range(10)) - picked)

    # 让页面能说清楚：推荐是新的，p 值是那天算的
    meta = data.setdefault("meta", {})
    meta["picks_refreshed_at"] = time.strftime("%Y-%m-%d %H:%M")
    meta.setdefault("stats_ran_at", meta.get("ran_at", "未知"))

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("已刷新推荐号码与盲区 → %s" % json_path)
    print("  推荐基于数据至：%s" % ", ".join(
        f"{g['name']} {g['last']}" for g in list(data["games"].values())[:3]))
    print("  p 值仍为 %s 那次完整分析的结果" % meta["stats_ran_at"])
    return data


if __name__ == "__main__":
    refresh(sys.argv[1] if len(sys.argv) > 1
            else os.path.join(ROOT, "src", "data", "lottery", "lottery_analysis.json"))
