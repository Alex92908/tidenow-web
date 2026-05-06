import { NextRequest, NextResponse } from "next/server"
import { getCachedSummary, setCachedSummary } from "@/lib/cache"
import { createHash } from "crypto"
import type { AIProvider } from "@/lib/ai-settings"

async function callAI(provider: AIProvider, apiKey: string, prompt: string): Promise<string> {
  switch (provider) {
    case "anthropic": {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 80,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "anthropic error")
      return d.content[0].text.trim()
    }

    case "openai": {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 80,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "openai error")
      return d.choices[0].message.content.trim()
    }

    case "deepseek": {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          max_tokens: 80,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "deepseek error")
      return d.choices[0].message.content.trim()
    }

    case "zhipu": {
      const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "glm-4-flash",
          max_tokens: 80,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "zhipu error")
      return d.choices[0].message.content.trim()
    }

    case "gemini": {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      )
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "gemini error")
      return d.candidates[0].content.parts[0].text.trim()
    }

    default:
      throw new Error("unsupported provider")
  }
}

export async function POST(req: NextRequest) {
  const { title, locale, provider, apiKey } = await req.json()
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 })
  if (!apiKey || !provider) return NextResponse.json({ error: "no api key" }, { status: 503 })

  // Cache key includes provider so different providers don't collide
  const titleHash = createHash("sha1").update(`${provider}:${title}`).digest("hex")
  const cached = getCachedSummary(titleHash)
  if (cached) return NextResponse.json({ summary: cached, cached: true })

  const isZh = locale === "zh"
  const prompt = isZh
    ? `用一句话（20字以内）解释以下新闻标题的背景，不要复述标题本身：\n${title}`
    : `In one sentence (under 15 words), explain the background context of this news headline without repeating it:\n${title}`

  try {
    const summary = await callAI(provider as AIProvider, apiKey, prompt)
    setCachedSummary(titleHash, summary)
    return NextResponse.json({ summary, cached: false })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
