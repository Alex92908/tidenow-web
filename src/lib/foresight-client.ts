// Node-side client for the ForeSight prediction function (api/predict.py).
// Server-only — the internal token must never reach the browser.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export interface ForesightResult {
  /** Routed domain, e.g. "scenario" | "opinion" | "sports" | ... */
  domain: string
  /** One-line routing reason. */
  reason: string
  /** The crisp yes/no question the engine evaluated. */
  question: string
  /** Calibrated probability in [0,1], or null for no-prediction domains
   *  (counterfactual / randomness / fiction modes). */
  probability: number | null
  /** Full markdown report — used as rich context for the writer. */
  markdown: string
}

/**
 * Ask ForeSight for a prediction on a seed. ForeSight reuses the SAME AI
 * key the user already entered in TideNow (BYOK) — no separate
 * provider key. Returns null on any failure (unsupported provider,
 * timeout, engine error) so the caller can degrade gracefully — a
 * prediction is an enhancement to the article, never a hard dependency.
 */
export async function getForesight(
  seed: string,
  byok: { provider: string; apiKey: string },
  opts: { domain?: string; symbol?: string; signal?: AbortSignal } = {}
): Promise<ForesightResult | null> {
  // ForeSight's LLM client speaks OpenAI-compatible + Anthropic. Google
  // Gemini (native API) and on-device Gemini Nano can't drive it, so
  // those users simply get no prediction rather than an error.
  if (byok.provider === "gemini" || byok.provider === "gemini-nano") return null
  if (!byok.apiKey) return null

  // Call the Python function on the same deployment. We hit the absolute
  // URL because a relative fetch from a route handler has no base.
  // FORESIGHT_PREDICT_URL overrides the target for local dev — point it
  // at a standalone predict.py server (see scripts/foresight-dev.py)
  // since `pnpm dev` can't run Vercel Python functions itself.
  const url = process.env.FORESIGHT_PREDICT_URL || `${SITE_URL}/api/predict`
  // Optional shared secret. When set (recommended in production) it stops
  // strangers from POSTing seeds to burn your function minutes. When
  // unset the endpoint still works — it does nothing useful without a
  // valid AI key in the body anyway.
  const token = process.env.FORESIGHT_INTERNAL_TOKEN

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        seed,
        domain: opts.domain ?? "auto",
        provider: byok.provider,
        apiKey: byok.apiKey,
        ...(opts.symbol ? { symbol: opts.symbol } : {}),
      }),
      signal: opts.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      route?: { domain?: string; reason?: string }
      result?: { probability?: number | null }
      question?: string
      markdown?: string
    }
    return {
      domain: data.route?.domain ?? "scenario",
      reason: data.route?.reason ?? "",
      question: data.question ?? "",
      probability:
        typeof data.result?.probability === "number" ? data.result.probability : null,
      markdown: data.markdown ?? "",
    }
  } catch {
    // AbortError / network / parse — all collapse to "no prediction".
    return null
  }
}

/** One stock in a market scan — a limit-up-relay candidate with the
 *  engine's "goes limit-up again tomorrow" probability. */
export interface ScanStock {
  code: string
  name: string
  height: number
  price: number | null
  industry?: string
  break_n?: number | null
  prob: number | null
  reason: string
  /** Present only for stale (ledger) rows already resolved. */
  outcome?: number | null
  ret?: number | null
}

export interface MarketScan {
  scan: string
  /** Trading day of the batch, YYYYMMDD, or null if the ledger is empty. */
  date: string | null
  stocks: ScanStock[]
  /** True when live fetch failed and we fell back to the git ledger. */
  stale?: boolean
}

/**
 * Scan today's limit-up pool and return MANY scored candidates (not a
 * single-event prediction). Data is eastmoney push2ex + Sina K-lines
 * (pure HTTP, no akshare). Reuses the caller's BYOK key for the per-stock
 * LLM adjustment. Returns null only on total failure — the Python side
 * already degrades to the git ledger, so a non-null result may be `stale`.
 */
export async function scanMarket(
  byok: { provider: string; apiKey: string },
  opts: { top?: number; signal?: AbortSignal } = {}
): Promise<MarketScan | null> {
  if (byok.provider === "gemini" || byok.provider === "gemini-nano") return null
  if (!byok.apiKey) return null

  const url = process.env.FORESIGHT_PREDICT_URL || `${SITE_URL}/api/predict`
  const token = process.env.FORESIGHT_INTERNAL_TOKEN
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        scan: "zt",
        top: opts.top ?? 8,
        provider: byok.provider,
        apiKey: byok.apiKey,
      }),
      signal: opts.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as MarketScan
  } catch {
    return null
  }
}

/** Render a ForeSight result as a compact context block for the writer
 *  prompt. We keep this terse — the full markdown report can be 1000+
 *  words and we only want the writer to ground a forward-looking
 *  paragraph, not transcribe the whole thing. */
export function foresightContextBlock(
  fs: ForesightResult,
  locale: "en" | "zh"
): string {
  const pct =
    fs.probability != null ? `${Math.round(fs.probability * 100)}%` : null
  if (locale === "zh") {
    const lines = [
      `【ForeSight 预测引擎分析】`,
      `领域路由：${fs.domain}（${fs.reason}）`,
      fs.question ? `核心问题：${fs.question}` : "",
      pct ? `校准概率：${pct}` : `（该领域不输出概率）`,
      ``,
      `分析摘要：`,
      fs.markdown.slice(0, 1500),
    ]
    return lines.filter(Boolean).join("\n")
  }
  const lines = [
    `[ForeSight prediction-engine analysis]`,
    `Domain route: ${fs.domain} (${fs.reason})`,
    fs.question ? `Core question: ${fs.question}` : "",
    pct ? `Calibrated probability: ${pct}` : `(this domain yields no probability)`,
    ``,
    `Analysis excerpt:`,
    fs.markdown.slice(0, 1500),
  ]
  return lines.filter(Boolean).join("\n")
}
