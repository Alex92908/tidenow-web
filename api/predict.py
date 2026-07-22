"""ForeSight prediction endpoint on Vercel's Python runtime.

This file lives at /api/predict and is invoked by TideNow's Node-side
compose pipeline. It thin-wraps `foresight.pipeline.predict_once`,
mapping HTTP JSON ↔ the Python function signature.

Layout note: the ForeSight package itself lives under lib/foresight/
(outside /api so Vercel doesn't try to turn each module into its own
function). vercel.json has an `includeFiles` rule that pulls the lib
into this function's bundle.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler

# Make the bundled foresight package importable. On Vercel the function
# is unpacked into /var/task, with lib/ included via vercel.json.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "lib"))

# Redirect ForeSight's prediction log out of the read-only deployment
# bundle. The default path is `<lib>/../predictions.jsonl`, which sits
# in /var/task on Vercel and fails with EROFS on every write. We move
# it to /tmp before importing pipeline (pipeline reaches calibration
# transitively, but LOG_PATH is a module-level constant — patching it
# after import is too late for the first invocation).
#
# Trade-off: /tmp is ephemeral per cold start, so the Brier calibration
# loop won't accumulate history across function invocations. That's a
# Phase 2 concern (push to Vercel Blob or similar); for now we accept
# losing the calibration tail in exchange for the endpoint working.
import tempfile
from foresight import calibration  # noqa: E402
calibration.LOG_PATH = os.path.join(tempfile.gettempdir(), "predictions.jsonl")

from foresight.pipeline import predict_once  # noqa: E402


# Map TideNow's BYOK provider id → the ForeSight LLM config. ForeSight
# reuses the SAME key the user already entered in TideNow, so there's no
# separate FORESIGHT_API_KEY. The OpenAI-compatible providers (deepseek,
# openai, zhipu) share one code path with different base_url/model;
# anthropic uses ForeSight's native-SDK branch. Gemini (Google native)
# and gemini-nano (on-device) can't drive ForeSight — the Node client
# filters those out before we ever get here.
_PROVIDER_CFG = {
    "deepseek": {"base_url": "https://api.deepseek.com", "model": "deepseek-chat", "provider": "openai"},
    "openai":   {"base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini",  "provider": "openai"},
    "zhipu":    {"base_url": "https://open.bigmodel.cn/api/paas/v4", "model": "glm-4-flash", "provider": "openai"},
    "anthropic": {"base_url": "https://api.anthropic.com", "model": "claude-haiku-4-5-20251001", "provider": "anthropic"},
}


def _llm_cfg_from_body(provider: str, api_key: str) -> dict:
    """Build the ForeSight llm config from the caller's BYOK credentials.
    The key arrives in the request body (server-to-server from TideNow's
    compose route) and is used for this single prediction only — never
    stored. Mock mode is still available via env for local smoke tests."""
    base = _PROVIDER_CFG.get(provider, _PROVIDER_CFG["deepseek"])
    return {
        "base_url": base["base_url"],
        "api_key": api_key,
        "model": base["model"],
        "provider": base["provider"],
        "temperature": float(os.environ.get("FORESIGHT_TEMPERATURE", "0.7")),
        "mock": os.environ.get("FORESIGHT_MOCK", "0") == "1",
    }


def _auth_ok(headers) -> bool:
    """A simple shared-secret check stops random internet traffic from
    burning the user's AI quota. TideNow's Node side sends this header
    via a server-only env var; nothing reaches the client."""
    expected = os.environ.get("FORESIGHT_INTERNAL_TOKEN", "")
    if not expected:
        # No token configured — fail closed in production, open in dev.
        # We treat the presence of VERCEL_ENV as the production signal.
        return os.environ.get("VERCEL_ENV") not in ("production", "preview")
    got = headers.get("authorization", "")
    return got == f"Bearer {expected}"


class handler(BaseHTTPRequestHandler):
    # Long-running predictions need the full timeout window; without
    # this Vercel kills the request at 10s on Hobby. Set the maxDuration
    # in vercel.json (we use 60s, the Pro plan ceiling).

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # CORS off by default — this endpoint is internal-only and
        # protected by FORESIGHT_INTERNAL_TOKEN. If we ever want to open
        # it up, the Access-Control-* headers can be added here.
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 (vercel signature)
        if not _auth_ok(self.headers):
            self._send(401, {"error": "unauthorised"})
            return

        try:
            content_length = int(self.headers.get("content-length", "0") or "0")
            raw = self.rfile.read(content_length) if content_length else b""
            body = json.loads(raw.decode("utf-8") or "{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "invalid json"})
            return

        # Market-scan mode carries no seed (it lists many stocks, doesn't
        # evaluate one event), so only enforce seed for the normal path.
        is_scan = (body.get("scan") or "") in ("zt", "funnel")
        seed = (body.get("seed") or "").strip()
        if not seed and not is_scan:
            self._send(400, {"error": "missing seed"})
            return

        # ForeSight reuses the caller's BYOK key. Without one (and not in
        # mock mode) there's nothing to drive the LLM with.
        provider = (body.get("provider") or "deepseek").strip()
        api_key = (body.get("apiKey") or "").strip()
        if not api_key and os.environ.get("FORESIGHT_MOCK", "0") != "1":
            self._send(400, {"error": "missing apiKey"})
            return

        # Market-scan mode: no single-event prediction, but a ranked list
        # of many stocks. Two flavours share this path:
        #   zt     — today's limit-up-relay candidates (eastmoney push2ex
        #            pool + Sina K-lines), one LLM adjust per stock.
        #   funnel — a slow-money basket (eastmoney earnings pre-announce
        #            + Sina K-lines), one LLM pick over the shortlist.
        # All data is pure HTTP, no akshare. If the live fetch fails — e.g.
        # the finance endpoints block Vercel's overseas IPs — we degrade to
        # the most recent git-tracked ledger batch so the page always
        # renders something.
        scan_kind = body.get("scan") or ""
        if scan_kind in ("zt", "funnel"):
            from foresight.llm import LLM

            try:
                top = int(body.get("top") or (8 if scan_kind == "zt" else 12))
            except (TypeError, ValueError):
                top = 8 if scan_kind == "zt" else 12
            top = max(1, min(top, 15))

            cfg = _llm_cfg_from_body(provider, api_key)
            mock = cfg.pop("mock", False)
            llm = LLM(cfg, mock=mock)

            if scan_kind == "zt":
                from foresight import screener as mod
                fetch = lambda: mod.rank(llm, top=top)  # noqa: E731
            else:
                from foresight import funnel as mod
                # pre bounds how many candidates get a K-line fetch before
                # the LLM picks. Growth-sorted, the very top is dominated by
                # low-base freaks (+60000%), so a bigger pool is what lets
                # reasonable-growth quality names reach the LLM at all.
                # 40 parallel fetches ≈ 4 waves of 10 workers — a few seconds
                # healthy, and the frontend degrades gracefully if slow.
                # mode: growth (default) / quality / wide — see funnel.rank.
                mode = body.get("mode") if body.get("mode") in ("growth", "quality", "wide") else "growth"
                fetch = lambda: mod.rank(llm, top=top, pre=40, mode=mode)  # noqa: E731

            try:
                payload = fetch()
                if not payload.get("stocks"):
                    payload = mod.latest_batch()
            except Exception:  # noqa: BLE001 — live fetch failed, fall back
                payload = mod.latest_batch()
            return self._send(200, {"scan": scan_kind, **payload})

        # All ForeSight predict_once kwargs are optional; we forward only
        # the ones the caller actually set so the function's own defaults
        # remain authoritative.
        kwargs: dict = {}
        for k in ("domain", "symbol", "csv", "odds", "agents", "rounds", "mode", "chapters"):
            if k in body and body[k] is not None:
                kwargs[k] = body[k]

        try:
            result = predict_once(
                seed,
                llm_cfg=_llm_cfg_from_body(provider, api_key),
                save_report=False,
                **kwargs,
            )
        except Exception as e:  # noqa: BLE001
            # ForeSight raises ValueError for empty seed, plus possible
            # provider errors. Surface the message but never the trace
            # (don't leak internals to the caller).
            return self._send(
                502,
                {
                    "error": str(e),
                    "type": type(e).__name__,
                    # The full trace is only useful while we're debugging
                    # the integration locally; gate behind explicit env.
                    "trace": (
                        traceback.format_exc()
                        if os.environ.get("FORESIGHT_DEBUG") == "1"
                        else None
                    ),
                },
            )

        self._send(200, result)

    def do_GET(self) -> None:  # noqa: N802
        # Lightweight health check — no auth required, no work done.
        self._send(200, {"ok": True, "service": "foresight"})
