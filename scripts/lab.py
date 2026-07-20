#!/usr/bin/env python3
"""ForeSight 股票实验 CLI（连板接力 zt / 慢钱漏斗 funnel）。

两个成对的可证伪实验，台账 git 追踪在 src/data/experiments/：
  - zt     ：连板接力（快钱）。预注册假设：概率可校准、盈亏为负。
  - funnel ：业绩预增漏斗（慢钱）。预注册假设：篮子小幅跑赢沪深300。

用法：
  pnpm lab:zt:scan          # 扫当日涨停池 → 打分 → 落台账
  pnpm lab:zt:resolve       # 次日判定（收盘口径）
  pnpm lab:zt:stats         # Brier + 虚拟盈亏

  pnpm lab:funnel:scan      # 业绩预增 → 过热过滤 → LLM 选篮 → 落台账
  pnpm lab:funnel:resolve   # 20 交易日后判定 vs 沪深300
  pnpm lab:funnel:stats     # 超额 alpha

或直接：
  .venv/bin/python scripts/lab.py zt scan [--top 10] [--date 20260717] [--mock]

配置（env，跟 TideNow 其余部分一致，不读 config.yaml）：
  FORESIGHT_API_KEY   必填（除非 --mock）
  FORESIGHT_BASE_URL  默认 https://api.deepseek.com
  FORESIGHT_MODEL     默认 deepseek-chat

数据源：全部纯 requests，无需 akshare——
  涨停池/连板 → 东财 push2ex；业绩预告 → 东财 datacenter；
  个股/指数日线 → 新浪 K 线。
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))

from foresight.llm import LLM  # noqa: E402


def _llm(mock: bool) -> LLM:
    """Build the LLM from env vars. TideNow keeps secrets in the environment
    (or the browser's BYOK settings), never in a checked-in config.yaml."""
    key = os.environ.get("FORESIGHT_API_KEY", "")
    if not key and not mock:
        print("❌ 需要 FORESIGHT_API_KEY 环境变量（或加 --mock 跑流程测试）")
        print("   例：FORESIGHT_API_KEY=sk-xxx pnpm lab:zt:scan")
        sys.exit(1)
    return LLM(
        {
            "base_url": os.environ.get("FORESIGHT_BASE_URL", "https://api.deepseek.com"),
            "api_key": key,
            "model": os.environ.get("FORESIGHT_MODEL", "deepseek-chat"),
            "provider": "openai",
            "temperature": 0.2,
        },
        mock=mock,
    )


def cmd_zt(args) -> None:
    from foresight import screener

    if args.action == "scan":
        screener.scan(_llm(args.mock), date=args.date, top=args.top)
    elif args.action == "resolve":
        n = screener.resolve_pending()
        print(f"已判定 {n} 条")
    else:
        print(json.dumps(screener.stats(), ensure_ascii=False, indent=2))


def cmd_funnel(args) -> None:
    from foresight import funnel

    if args.action == "scan":
        funnel.scan(_llm(args.mock), date=args.date, top=args.top)
    elif args.action == "resolve":
        n = funnel.resolve_pending()
        print(f"已判定 {n} 条")
    else:
        print(json.dumps(funnel.stats(), ensure_ascii=False, indent=2))


def main() -> None:
    p = argparse.ArgumentParser(description="ForeSight 股票实验（台账 git 追踪）")
    sub = p.add_subparsers(dest="cmd", required=True)

    z = sub.add_parser("zt", help="连板接力实验（快钱）")
    z.add_argument("action", choices=["scan", "resolve", "stats"])
    z.add_argument("--top", type=int, default=10)
    z.add_argument("--date", default=None, help="YYYYMMDD，默认今天")
    z.add_argument("--mock", action="store_true", help="不调 API，测流程")
    z.set_defaults(func=cmd_zt)

    f = sub.add_parser("funnel", help="慢钱漏斗实验")
    f.add_argument("action", choices=["scan", "resolve", "stats"])
    f.add_argument("--top", type=int, default=12)
    f.add_argument("--date", default=None, help="YYYYMMDD，默认今天")
    f.add_argument("--mock", action="store_true")
    f.set_defaults(func=cmd_funnel)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
