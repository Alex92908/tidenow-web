// Shared server-side AI caller — moved verbatim from
// src/app/api/compose/route.ts so the compose route and the daily-digest
// cron route use the exact same provider logic. The caller passes the key
// in; this module never reads keys from anywhere and never logs them.
//
// Providers (all OpenAI-compatible chat-completions shape except
// anthropic/gemini, which have their own wire format):
//   anthropic → claude-haiku-4-5-20251001
//   openai    → gpt-4o-mini
//   deepseek  → deepseek-chat (cheapest sensible default for the digest)
//   zhipu     → glm-4-flash
//   gemini    → gemini-1.5-flash
import type { AIProvider } from "./ai-settings"

export async function callAI(
  provider: AIProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
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

/** Providers the daily-digest cron accepts via DIGEST_AI_PROVIDER. */
export const DIGEST_PROVIDERS: readonly string[] = [
  "deepseek",
  "openai",
  "anthropic",
  "zhipu",
  "gemini",
]

export function isDigestProvider(v: string): v is AIProvider {
  return (DIGEST_PROVIDERS as readonly string[]).includes(v)
}
