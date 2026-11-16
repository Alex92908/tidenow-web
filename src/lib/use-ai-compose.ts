"use client"

import { useCallback, useState } from "react"
import { getAISettings } from "@/lib/ai-settings"
import type { DraftMaterial, DraftStyle } from "@/lib/compose-storage"

interface ComposeArgs {
  style: DraftStyle
  customPrompt?: string
  materials: DraftMaterial[]
  locale: "en" | "zh"
  /** Opt-in: route the lead material through the ForeSight prediction
   *  engine and have the writer ground a forward-looking section in it. */
  foresight?: boolean
}

interface ComposeState {
  markdown: string
  loading: boolean
  error: string | null
  /** True when generation stopped because no usable AI key is configured —
   * the UI renders an inline "Set AI key" button next to the error instead
   * of telling the user to go hunt for a settings icon elsewhere. */
  needsKey: boolean
}

// Companion to useAISummary, but for full-article generation. Returns the
// generated markdown via state (not a callback) so the editor below can
// just bind it like a normal field. We deliberately do NOT auto-trigger on
// material changes — generation is explicit, behind a "✦ Generate" button.
export function useAICompose() {
  const [state, setState] = useState<ComposeState>({ markdown: "", loading: false, error: null, needsKey: false })

  const generate = useCallback(async ({ style, customPrompt, materials, locale, foresight }: ComposeArgs) => {
    if (materials.length === 0) {
      setState({ markdown: "", loading: false, error: "No materials selected", needsKey: false })
      return
    }
    const settings = getAISettings()
    if (!settings?.apiKey && settings?.provider !== "gemini-nano") {
      setState({
        markdown: "",
        loading: false,
        error: "AI key not set.",
        needsKey: true,
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
        error: "On-device Gemini Nano is too small for article generation. Pick a cloud provider.",
        needsKey: true,
      })
      return
    }

    setState({ markdown: "", loading: true, error: null, needsKey: false })
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
          foresight: foresight ?? false,
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
        setState({ markdown: "", loading: false, error: data.error ?? `HTTP ${res.status}`, needsKey: false })
        return
      }
      setState({ markdown: data.markdown ?? "", loading: false, error: null, needsKey: false })
    } catch (e) {
      setState({ markdown: "", loading: false, error: (e as Error).message, needsKey: false })
    }
  }, [])

  const reset = useCallback(() => {
    setState({ markdown: "", loading: false, error: null, needsKey: false })
  }, [])

  return { ...state, generate, reset }
}
