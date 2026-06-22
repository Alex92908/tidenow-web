import { NextRequest, NextResponse } from "next/server"
import type { AIProvider } from "@/lib/ai-settings"
import { getForesight } from "@/lib/foresight-client"

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
}

export async function POST(req: NextRequest) {
  let body: PredictRequest
  try {
    body = (await req.json()) as PredictRequest
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const { provider, apiKey, seed, domain } = body
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "missing provider/apiKey" }, { status: 503 })
  }
  if (!seed?.trim()) {
    return NextResponse.json({ error: "missing seed" }, { status: 400 })
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

  let fs = await getForesight(seed.trim(), { provider, apiKey }, { domain })

  // The 'market' (quant) backend needs a price feed (akshare or an
  // uploaded CSV), neither of which exists in this deployment — so a
  // market route always errors with "需要数据源". When auto-routing lands
  // there, silently redo the prediction as 'scenario' (the general
  // narrative-forecast backend), which handles company/price events fine
  // without market data. This costs one extra call only in that case.
  if (fs && fs.domain === "market") {
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
