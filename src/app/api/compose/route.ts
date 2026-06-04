import { NextRequest, NextResponse } from "next/server"
import type { AIProvider } from "@/lib/ai-settings"

// Long-form companion to /api/summary. Same BYOK pattern (the key is sent
// per-request from localStorage, never stored server-side), but with a
// much larger max_tokens budget for full articles and no result cache —
// articles are user-specific, caching them would leak across visitors.
//
// We intentionally do NOT echo the user's key into any log or response.

const MAX_TOKENS_BY_STYLE: Record<string, number> = {
  deep: 2200,      // 800–1200字 zh / 600–900 words en
  quick: 1100,     // 400–600字 / ~350 words
  list: 1600,
  personal: 1800,
  custom: 2200,
}

async function callAI(
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

// Long requests can take 20s+; bump from the 10s default so Vercel
// doesn't kill us mid-stream on slow providers.
export const maxDuration = 60

interface ComposeRequest {
  provider: AIProvider
  apiKey: string
  locale: "en" | "zh"
  style: "deep" | "quick" | "list" | "personal" | "custom"
  customPrompt?: string
  materials: { sourceName: string; title: string; url: string; extra?: string }[]
}

const STYLE_INSTRUCTIONS_ZH: Record<string, string> = {
  deep: "用 800-1200 字写一篇有观点的深度评论。结构上：开头钩子吸引读者 → 现象描述 → 原因分析 → 趋势预判。语气稳重克制，避免营销腔。如果素材之间能形成对比或互证，请挑明。",
  quick: "用 400-600 字写一篇 2 分钟速读总结。用 3-5 个小标题分段，每段不超过 100 字。让读者快速掌握今天发生了什么。",
  list: "用列表体写一篇文章：「Top N + 一句话点评」的格式。每条点评不超过 50 字。可适当编号或加 emoji 区分。",
  personal: "以第一人称写一篇 600-900 字的个人观察。带入自己的看法、经验或情绪，避免冷冰冰的事实罗列。语气像在朋友圈或即刻发动态。",
  custom: "",
}
const STYLE_INSTRUCTIONS_EN: Record<string, string> = {
  deep: "Write an 800-1200 word opinion piece. Structure: a hook lead → describe the phenomenon → analyze causes → forecast trends. Measured tone, no marketing fluff. If the source items contrast or reinforce each other, call it out.",
  quick: "Write a 400-600 word 2-minute read. Use 3-5 sub-headings, each section under 100 words. Reader should grasp what happened today fast.",
  list: "Write in list format: 'Top N + one-line take' per item. Each take under 50 words. Use numbers or emoji to differentiate.",
  personal: "Write 600-900 words in first person. Include personal view, experience, or feeling. Avoid dry fact-stacking. Casual blog/journal tone.",
  custom: "",
}

export async function POST(req: NextRequest) {
  let body: ComposeRequest
  try {
    body = (await req.json()) as ComposeRequest
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const { provider, apiKey, locale, style, customPrompt, materials } = body
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "missing provider/apiKey" }, { status: 503 })
  }
  if (!materials?.length) {
    return NextResponse.json({ error: "no materials" }, { status: 400 })
  }

  const isZh = locale === "zh"
  const styleInstr =
    style === "custom"
      ? (customPrompt ?? "").trim() || (isZh ? "请根据素材自由发挥写一篇文章。" : "Write an article freely based on the materials.")
      : isZh
        ? STYLE_INSTRUCTIONS_ZH[style]
        : STYLE_INSTRUCTIONS_EN[style]

  const systemPrompt = isZh
    ? `你是一个公众号/头条创作者。${styleInstr}\n\n硬性要求：\n- 全文必须使用简体中文，无论素材是什么语言\n- 输出 Markdown 格式：# 一级标题在最前，## 二级标题分段\n- 不要复述素材标题；用自己的话总结和延展\n- 不要在文中说"根据某某热榜"，要像编辑写文章，不要像 AI 在汇报\n- 结尾不要套话（"总之"、"让我们拭目以待"），用一句有信息量的话收尾`
    : `You are a writer producing newsletter / blog content. ${styleInstr}\n\nStrict rules:\n- Reply in English only, regardless of the source language\n- Output Markdown: # H1 at top, ## H2 for sections\n- Don't restate source headlines verbatim; synthesize and extend in your own words\n- Don't say "according to trending lists"; write like an editor, not an AI reporting\n- No filler closing ("In conclusion", "Time will tell") — end with one substantive sentence`

  const materialBlock = materials
    .map(
      (m, i) =>
        `${i + 1}. [${m.sourceName}] ${m.title}${m.extra ? `\n   ${m.extra}` : ""}\n   ${m.url}`
    )
    .join("\n\n")

  const userPrompt = isZh
    ? `以下是 ${materials.length} 条今日热点素材，请基于它们写文章：\n\n${materialBlock}\n\n现在开始写：`
    : `Here are ${materials.length} trending items today. Use them to write the article:\n\n${materialBlock}\n\nBegin:`

  const maxTokens = MAX_TOKENS_BY_STYLE[style] ?? 2000

  try {
    const markdown = await callAI(provider, apiKey, systemPrompt, userPrompt, maxTokens)
    return NextResponse.json({ markdown })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
