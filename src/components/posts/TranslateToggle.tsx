"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getAISettings } from "@/lib/ai-settings"

interface Props {
  slug: string
  /** The locale the post was authored in. The translate button targets
   *  the OTHER locale (zh → en, en → zh). */
  postLocale: "en" | "zh"
  /** The page-level UI locale — drives the button label so a zh-UI user
   *  reading an en post sees the label in Chinese, and vice versa. */
  uiLocale: "en" | "zh"
  body: string
}

// Toggle between the authored body and an AI translation of it. Uses the
// existing BYOK pattern (key in localStorage, forwarded once per call,
// never persisted server-side). Successful translations are cached in
// localStorage keyed by (slug, targetLang), so repeated toggles are
// instant and burn zero API tokens after the first round-trip.
export function TranslateToggle({ slug, postLocale, uiLocale, body }: Props) {
  const targetLang: "en" | "zh" = postLocale === "zh" ? "en" : "zh"
  const cacheKey = `tidenow-translation-${slug}-${targetLang}`

  const [translated, setTranslated] = useState<string | null>(null)
  const [showing, setShowing] = useState<"original" | "translated">("original")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate from cache so a returning visitor sees the toggle act as a
  // free swap, not as "translate again."
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) setTranslated(cached)
    } catch {
      // localStorage can throw in private-browsing / strict-cookie modes
    }
  }, [cacheKey])

  async function handleClick() {
    setError(null)
    // Already translated once this session — just flip which copy we show.
    if (translated) {
      setShowing(showing === "original" ? "translated" : "original")
      return
    }

    const settings = getAISettings()
    if (!settings?.provider || !settings?.apiKey) {
      setError(
        uiLocale === "zh"
          ? "请先在主页右上角 ✦ 按钮里设置 AI key。"
          : "Set an AI key first via the ✦ button in the home page header."
      )
      return
    }
    // Gemini Nano (on-device) is too small for the long-form output a
    // post body needs and silently truncates. Force a cloud provider.
    if (settings.provider === "gemini-nano") {
      setError(
        uiLocale === "zh"
          ? "Gemini Nano(本地)对长文翻译能力不足,请切到云端 provider。"
          : "On-device Gemini Nano is too small for long-form translation. Pick a cloud provider."
      )
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/translate-post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.apiKey,
          markdown: body,
          sourceLang: postLocale,
          targetLang,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setTranslated(data.markdown)
      setShowing("translated")
      try {
        localStorage.setItem(cacheKey, data.markdown)
      } catch {
        // Storage quota / private mode — translation still works in
        // memory, just won't survive a page reload.
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = (() => {
    if (loading) return uiLocale === "zh" ? "翻译中…" : "Translating…"
    if (showing === "translated") {
      return uiLocale === "zh" ? "📄 显示原文" : "📄 Show original"
    }
    // Showing original — offer translation. Label uses the TARGET
    // language's name in the UI locale (so a zh-UI user sees "翻译为
    // English"; an en-UI user reading a zh post sees "Translate to
    // English"). This is what the reader is about to GET, not what
    // they're switching FROM.
    if (uiLocale === "zh") {
      return targetLang === "en" ? "🌐 翻译为 English" : "🌐 翻译为中文"
    }
    return targetLang === "en" ? "🌐 Translate to English" : "🌐 Translate to Chinese"
  })()

  const isTranslatedView = showing === "translated" && translated !== null
  const display = isTranslatedView ? translated : body

  return (
    <>
      <div className="not-prose mb-6 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {buttonLabel}
        </button>
        {isTranslatedView && (
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            {uiLocale === "zh"
              ? "AI 译文,可能存在偏差"
              : "AI translation — may not be perfect"}
          </span>
        )}
        {error && (
          <span className="text-[11px] text-rose-500">{error}</span>
        )}
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{display}</ReactMarkdown>
    </>
  )
}
