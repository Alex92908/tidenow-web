#!/usr/bin/env python3
"""Run the ForeSight predict handler as a standalone local server.

`pnpm dev` (Next.js) can't execute Vercel Python functions, so for
local end-to-end testing we serve the same handler ourselves on a
plain port. Point the Node side at it with:

    FORESIGHT_PREDICT_URL=http://127.0.0.1:8787 pnpm dev

Then the Compose '🔮 ForeSight' toggle hits this server instead of
production.

Usage:
    # mock mode — no token, no real LLM calls (fastest sanity check)
    FORESIGHT_MOCK=1 python3 scripts/foresight-dev.py

    # real mode — ForeSight uses whatever key the compose request
    # carries (your TideNow BYOK key), so nothing to set here.
    python3 scripts/foresight-dev.py
"""
from __future__ import annotations

import os
import sys
from http.server import HTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Mirror what Vercel does: make the bundled package importable and route
# the prediction log to a writable temp path before importing the handler.
sys.path.insert(0, os.path.join(ROOT, "api"))

# Import the handler class straight from the function file.
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "predict", os.path.join(ROOT, "api", "predict.py")
)
predict = importlib.util.module_from_spec(spec)
spec.loader.exec_module(predict)


def main() -> None:
    port = int(os.environ.get("FORESIGHT_DEV_PORT", "8787"))
    server = HTTPServer(("127.0.0.1", port), predict.handler)
    mode = "mock" if os.environ.get("FORESIGHT_MOCK") == "1" else "real"
    print(f"ForeSight dev server → http://127.0.0.1:{port}  ({mode} mode)")
    print(f"Point Node at it:  FORESIGHT_PREDICT_URL=http://127.0.0.1:{port} pnpm dev")
    print("Health check:  curl http://127.0.0.1:%d" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
