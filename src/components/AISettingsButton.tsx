"use client"

import { useState, useEffect } from "react"
import { AISettingsModal } from "./AISettingsModal"
import { getAISettings } from "@/lib/ai-settings"

// The AI key setting used to be a tiny icon-only ✦ — a "mystery meat"
// button: ✦ reads as "AI/sparkle", not "settings", and icon-only buttons
// are recognised ~70% of the time without a label. Every other product
// does this as a labeled entry (gear ⚙️ + text, e.g. Cal.com's header
// gear, GitHub's avatar → Settings). So this is a labeled pill with a
// gear and real text, always visible in the nav, with a pale amber tint
// + dot while no key is set so it reads as "needs setup" at a glance.
export function AISettingsButton({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false)
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    setHasKey(!!getAISettings())
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={locale === "zh" ? "AI 摘要设置" : "AI Summary Settings"}
        className={[
          "relative flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap",
          hasKey
            ? "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20"
            : "text-gray-700 dark:text-zinc-200 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 ring-1 ring-amber-200 dark:ring-amber-500/30",
        ].join(" ")}
      >
        <span className="text-sm leading-none">⚙️</span>
        <span>{locale === "zh" ? "AI 设置" : "AI Settings"}</span>
        {!hasKey && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#0a0a0f]" />
        )}
      </button>
      {open && <AISettingsModal locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
