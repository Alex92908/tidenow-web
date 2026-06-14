import { NextRequest, NextResponse } from "next/server"
import type { AIProvider } from "@/lib/ai-settings"

// Long-form post translation. BYOK same as /api/compose — the user's key
// is forwarded for a single request, never stored. Output budget is
// generous (6000 tokens) because translated markdown is roughly the
// same length as the input and we don't want truncation mid-paragraph.

async function callAI(
  provider: AIProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const maxTokens = 6000

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
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
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
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
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
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
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
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
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
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      )
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "gemini error")
      return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    }
    default:
      throw new Error("unsupported provider")
  }
}

export const maxDuration = 60

interface TranslateRequest {
  provider: AIProvider
  apiKey: string
  markdown: string
  sourceLang: "en" | "zh"
  targetLang: "en" | "zh"
}

const LANG_LABEL = { en: "English", zh: "Simplified Chinese (简体中文)" } as const

export async function POST(req: NextRequest) {
  let body: TranslateRequest
  try {
    body = (await req.json()) as TranslateRequest
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const { provider, apiKey, markdown, sourceLang, targetLang } = body
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "missing provider/apiKey" }, { status: 503 })
  }
  if (!markdown?.trim()) {
    return NextResponse.json({ error: "empty markdown" }, { status: 400 })
  }
  if (sourceLang === targetLang) {
    return NextResponse.json({ markdown })
  }

  // The translation prompt has three jobs: preserve markdown structure,
  // protect code/URLs from translation, and avoid the literal word-by-word
  // output that most translation prompts default to.
  const systemPrompt = `You are a professional translator. Translate the user's Markdown content from ${LANG_LABEL[sourceLang]} to ${LANG_LABEL[targetLang]}.

Strict rules:
- Preserve ALL Markdown structure: # headings, ## subheadings, lists, blockquotes, **bold**, *italic*, [link text](url), images, tables, horizontal rules.
- Do NOT translate code: anything inside \`\`\` fenced blocks or \`inline code\` must be reproduced verbatim.
- Do NOT translate URLs. Inside [text](url), translate the text but keep the url unchanged.
- Keep proper nouns and product names in their commonly recognized form. Hacker News, GitHub, Reuters, BBC, Weibo, Bilibili etc. stay as-is. Acronyms (AI, API, GPU, JSON) stay as-is.
- Translate meaning, not word-for-word. If the source uses an idiom, render it as the closest natural idiom in the target language.
- Preserve frontmatter (any \`---\`-delimited YAML block at the top) verbatim — do not touch its keys or values.

Output ONLY the translated Markdown. No preamble like "Here is the translation:". No closing remark. No language tag.`

  try {
    const translated = await callAI(provider, apiKey, systemPrompt, markdown)
    return NextResponse.json({ markdown: translated })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
