"use client"

import { useCallback, useState } from "react"
import { getAISettings } from "@/lib/ai-settings"
import type { DraftMaterial, DraftStyle } from "@/lib/compose-storage"

interface ComposeArgs {
  style: DraftStyle
  customPrompt?: string
  materials: DraftMaterial[]
  locale: "en" | "zh"
}

interface ComposeState {
  markdown: string
  loading: boolean
  error: string | null
}

// Companion to useAISummary, but for full-article generation. Returns the
// generated markdown via state (not a callback) so the editor below can
// just bind it like a normal field. We deliberately do NOT auto-trigger on
// material changes — generation is explicit, behind a "✦ Generate" button.
export function useAICompose() {
  const [state, setState] = useState<ComposeState>({ markdown: "", loading: false, error: null })

  const generate = useCallback(async ({ style, customPrompt, materials, locale }: ComposeArgs) => {
    if (materials.length === 0) {
      setState({ markdown: "", loading: false, error: "No materials selected" })
      return
    }
    const settings = getAISettings()
    if (!settings?.apiKey && settings?.provider !== "gemini-nano") {
      setState({
        markdown: "",
        loading: false,
        error: "AI key not set. Configure in the ✦ button on the home page.",
      })
      return
    }
    // Gemini Nano (on-device) doesn't support multi-thousand-token generation
    // and has no system prompt support equivalent to the cloud APIs. For
    // article writing we require a cloud provider.
    if (settings.provider === "gemini-nano") {
      setState({
        markdown: "",
        loading: false,
        error: "On-device Gemini Nano is too small for article generation. Pick a cloud provider in ✦.",
      })
      return
    }

    setState({ markdown: "", loading: true, error: null })
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.apiKey,
          locale,
          style,
          customPrompt,
          materials: materials.map((m) => ({
            sourceName: m.sourceName,
            title: m.title,
            url: m.url,
            extra: m.extra,
            image: m.image,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState({ markdown: "", loading: false, error: data.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ markdown: data.markdown ?? "", loading: false, error: null })
    } catch (e) {
      setState({ markdown: "", loading: false, error: (e as Error).message })
    }
  }, [])

  const reset = useCallback(() => {
    setState({ markdown: "", loading: false, error: null })
  }, [])

  return { ...state, generate, reset }
}
