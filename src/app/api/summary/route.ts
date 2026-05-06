import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getCachedSummary, setCachedSummary } from "@/lib/cache"
import { createHash } from "crypto"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { title, locale } = await req.json()
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no api key" }, { status: 503 })

  const titleHash = createHash("sha1").update(title).digest("hex")

  // Return cached summary if available
  const cached = getCachedSummary(titleHash)
  if (cached) return NextResponse.json({ summary: cached, cached: true })

  const isZh = locale === "zh"
  const prompt = isZh
    ? `用一句话（20字以内）解释以下新闻标题的背景，不要复述标题本身：\n${title}`
    : `In one sentence (under 15 words), explain the background context of this news headline without repeating it:\n${title}`

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    messages: [{ role: "user", content: prompt }],
  })

  const summary = (msg.content[0] as { text: string }).text.trim()
  setCachedSummary(titleHash, summary)

  return NextResponse.json({ summary, cached: false })
}
