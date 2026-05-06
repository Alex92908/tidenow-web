"use client"

import { useState, useEffect } from "react"
import { AISettingsModal } from "./AISettingsModal"
import { getAISettings } from "@/lib/ai-settings"

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
          "w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all",
          hasKey
            ? "text-sky-500 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10"
            : "text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5",
        ].join(" ")}
      >
        ✦
      </button>
      {open && <AISettingsModal locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
