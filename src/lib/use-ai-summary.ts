"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getAISettings } from "@/lib/ai-settings"

/** How long the cursor must rest before we kick off a summary fetch.
 *  Long enough that quick scans don't trigger waste; short enough that
 *  a deliberate "look at this one" feels responsive. */
const HOVER_DELAY_MS = 600

/**
 * Shared hover-to-load AI summary hook used by both SourceCard rows and
 * TrendingTopics rows.
 *
 * Returns `{ summary, loading, hoverProps }`. Spread `hoverProps` onto the
 * row's outermost element — it schedules the fetch after a hover dwell of
 * {@link HOVER_DELAY_MS} ms and cancels on mouse leave so passing the
 * cursor over many rows doesn't fan out a wall of API calls.
 *
 * Locale is enforced both at the prompt level (server-side, in
 * /api/summary) and via the systemPrompt for on-device Gemini Nano — so a
 * CN-locale user always gets 中文 summaries even for English headlines,
 * and vice versa.
 */
export function useAISummary(title: string, locale: string) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback(async () => {
    if (summary !== null || loading) return
    const settings = getAISettings()
    if (!settings) return
    setLoading(true)
    try {
      // Gemini Nano runs fully on-device via Chrome's built-in AI API
      if (settings.provider === "gemini-nano") {
        // @ts-expect-error Chrome AI API not yet in TS lib
        const session = await window?.ai?.languageModel?.create({
          systemPrompt: locale === "zh"
            ? "你是一个新闻摘要助手。无论标题是什么语言，都必须用简体中文一句话解释新闻标题的背景或意义，30 字以内。只输出这一句，不要前缀。"
            : "You are a news summarizer. Headline may be in any language; respond in English only. One sentence, under 20 words, explaining the background. Output only that sentence.",
        })
        if (!session) return
        const result = await session.prompt(title)
        session.destroy()
        setSummary(result?.trim() ?? null)
        return
      }

      // Cloud providers go through the server-side proxy
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          locale,
          provider: settings.provider,
          apiKey: settings.apiKey,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary)
      }
    } finally {
      setLoading(false)
    }
  }, [title, locale, summary, loading])

  const schedule = useCallback(() => {
    // Already loading, already loaded, or already scheduled? skip.
    if (summary !== null || loading || timerRef.current) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      fire()
    }, HOVER_DELAY_MS)
  }, [fire, summary, loading])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Clean up any pending timer on unmount so we don't fire after the row
  // has scrolled off the DOM.
  useEffect(() => () => cancel(), [cancel])

  return {
    summary,
    loading,
    hoverProps: { onMouseEnter: schedule, onMouseLeave: cancel },
  }
}
