"use client"

import { useState, useEffect } from "react"
import { type FontSize, STEPS, getFontSize, saveFontSize, stepFontSize, applyFontSize } from "@/lib/font-settings"

export function FontSizeControl() {
  const [size, setSize] = useState<FontSize>("md")

  useEffect(() => {
    const s = getFontSize()
    setSize(s)
    applyFontSize(s)
  }, [])

  function change(dir: 1 | -1) {
    const next = stepFontSize(size, dir)
    if (next === size) return
    setSize(next)
    saveFontSize(next)
  }

  return (
    <div className="flex items-center rounded-full border border-gray-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => change(-1)}
        disabled={size === STEPS[0]}
        className="w-7 h-7 flex items-center justify-center text-[11px] font-bold text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Smaller text"
      >
        A
      </button>
      <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
      <button
        onClick={() => change(1)}
        disabled={size === STEPS[STEPS.length - 1]}
        className="w-7 h-7 flex items-center justify-center text-[14px] font-bold text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        title="Larger text"
      >
        A
      </button>
    </div>
  )
}
