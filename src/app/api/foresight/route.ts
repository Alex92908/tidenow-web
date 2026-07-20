import { NextRequest, NextResponse } from "next/server"
import type { AIProvider } from "@/lib/ai-settings"
import { getForesight, scanMarket } from "@/lib/foresight-client"

// Browser-facing endpoint for the standalone /predict page. Same BYOK
// pattern as compose: the key arrives per-request from localStorage and
// is forwarded to the ForeSight engine for this single prediction only.
// This wraps the server-only foresight-client so the browser never sees
// FORESIGHT_INTERNAL_TOKEN.

export const maxDuration = 60

interface PredictRequest {
  provider: AIProvider
  apiKey: string
  seed: string
  domain?: string
  /** Stock code for the market/quant domain (e.g. 600519). With it, the
   *  quant backend fetches real quotes (Sina daily K-line, no akshare). */
  symbol?: string
  /** Market-scan mode: ignore seed, return many candidates. "zt" =
   *  limit-up relay pool; "funnel" = slow-money basket. Data via
   *  eastmoney/Sina HTTP, no akshare. */
  scan?: "zt" | "funnel"
  top?: number
}

export async function POST(req: NextRequest) {
  let body: PredictRequest
  try {
    body = (await req.json()) as PredictRequest
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const { provider, apiKey, seed, domain, symbol, scan, top } = body
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "missing provider/apiKey" }, { status: 503 })
  }
  // ForeSight's LLM speaks OpenAI-compatible + Anthropic only.
  if (provider === "gemini" || provider === "gemini-nano") {
    return NextResponse.json(
      {
        error:
          "ForeSight needs a cloud provider that speaks the OpenAI or Anthropic API (DeepSeek / OpenAI / Anthropic / Zhipu). Google Gemini and on-device Nano aren't supported.",
      },
      { status: 400 }
    )
  }

  // Market-scan mode returns many candidates and carries no seed.
  if (scan === "zt" || scan === "funnel") {
    const result = await scanMarket({ provider, apiKey }, { kind: scan, top })
    if (!result) {
      return NextResponse.json(
        { error: "scan failed — check your API key and try again" },
        { status: 502 }
      )
    }
    return NextResponse.json(result)
  }

  if (!seed?.trim()) {
    return NextResponse.json({ error: "missing seed" }, { status: 400 })
  }

  let fs = await getForesight(seed.trim(), { provider, apiKey }, { domain, symbol })

  // The 'market' (quant) backend needs a price feed. With a symbol it
  // fetches real quotes (Sina daily K-line). WITHOUT a symbol it can't,
  // so an auto-route that lands on market with no code is silently redone
  // as 'scenario' (the general narrative backend, which handles company/
  // price events fine). If the user gave a symbol, let market run.
  if (fs && fs.domain === "market" && !symbol) {
    const retried = await getForesight(seed.trim(), { provider, apiKey }, { domain: "scenario" })
    if (retried) fs = retried
  }

  if (!fs) {
    return NextResponse.json(
      { error: "prediction failed — check your API key and try again" },
      { status: 502 }
    )
  }
  return NextResponse.json(fs)
}
