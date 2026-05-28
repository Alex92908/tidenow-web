"use client"

import { useEffect, useState } from "react"
import { FilterSettingsModal } from "./FilterSettingsModal"

const STORAGE_KEY = "tidenow-mute-keywords"
const CHANGE_EVENT = "tidenow-mutes-changed"

/**
 * Header-mounted button that opens the FilterSettingsModal. Mirrors the
 * AISettingsButton pattern (small icon, opens a centered modal with
 * backdrop) instead of using an inline popover so positioning stays
 * predictable across screen sizes.
 */
export function FilterSettingsButton({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)

  // Track the mute-list size for the header badge. Re-read both on mount,
  // every time the modal closes, and on the cross-component custom event
  // the modal dispatches when saved.
  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return setCount(0)
        const arr = JSON.parse(raw) as string[]
        setCount(Array.isArray(arr) ? arr.length : 0)
      } catch {
        setCount(0)
      }
    }
    read()
    window.addEventListener(CHANGE_EVENT, read)
    return () => window.removeEventListener(CHANGE_EVENT, read)
  }, [open])

  const active = count > 0
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={locale === "zh" ? "屏蔽关键词" : "Mute keywords"}
        className={[
          "h-8 flex items-center justify-center rounded-full text-sm transition-all",
          active ? "px-2.5 gap-1" : "w-8",
          active
            ? "text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            : "text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5",
        ].join(" ")}
      >
        <span className="leading-none">⚙</span>
        {active && <span className="text-[11px] font-medium tabular-nums">{count}</span>}
      </button>
      {open && <FilterSettingsModal locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
