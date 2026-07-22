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

/** One stock in a market scan. Fields are a superset of both scan kinds:
 *  zt (limit-up relay) uses height/price/prob/reason; funnel (slow-money
 *  basket) uses growth/chg60/tag/why. Resolved ledger rows add outcome/
 *  ret (zt) or ret/alpha (funnel). */
export interface ScanStock {
  code: string
  name: string
  reason?: string
  // zt fields
  height?: number
  price?: number | null
  industry?: string
  break_n?: number | null
  prob?: number | null
  outcome?: number | null
  // funnel fields
  growth?: number | null
  chg120?: number | null
  chg60?: number | null
  chg30?: number | null
  chg15?: number | null
  chg7?: number | null
  tag?: string
  why?: string
  entry_price?: number | null
  alpha?: number | null
  // shared (resolved)
  ret?: number | null
}

export type ScanKind = "zt" | "funnel"

export interface MarketScan {
  scan: ScanKind
  /** Trading day of the batch, YYYYMMDD, or null if the ledger is empty. */
  date: string | null
  /** funnel only: the earnings report period the basket keys off. */
  period?: string | null
  stocks: ScanStock[]
  /** True when live fetch failed and we fell back to the git ledger. */
  stale?: boolean
}

/**
 * Scan the market and return MANY candidates (not a single-event
 * prediction). kind "zt" = today's limit-up-relay pool; "funnel" = a
 * slow-money earnings-growth basket. Data is eastmoney + Sina over plain
 * HTTP (no akshare), scored with the caller's BYOK key. Returns null only
 * on total failure — the Python side already degrades to the git ledger,
 * so a non-null result may be `stale`.
 */
export async function scanMarket(
  byok: { provider: string; apiKey: string },
  opts: { kind?: ScanKind; top?: number; signal?: AbortSignal } = {}
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
        scan: opts.kind ?? "zt",
        ...(opts.top ? { top: opts.top } : {}),
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
