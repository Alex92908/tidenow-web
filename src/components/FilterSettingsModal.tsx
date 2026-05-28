"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "tidenow-mute-keywords"
const CHANGE_EVENT = "tidenow-mutes-changed"

interface Props {
  onClose: () => void
  locale: string
}

export function FilterSettingsModal({ onClose, locale }: Props) {
  const isZh = locale === "zh"
  const [draft, setDraft] = useState("")
  const [count, setCount] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        if (Array.isArray(arr)) {
          setDraft(arr.join(", "))
          setCount(arr.length)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  function commit() {
    const parsed = draft
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      if (parsed.length === 0) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      // Notify same-window listeners — `storage` event only fires across tabs.
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch {
      // ignore
    }
    setCount(parsed.length)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 700)
  }

  function clearAll() {
    setDraft("")
    try {
      localStorage.removeItem(STORAGE_KEY)
      window.dispatchEvent(new Event(CHANGE_EVENT))
    } catch {
      // ignore
    }
    setCount(0)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 flex flex-col gap-5 overflow-y-auto"
        style={{ maxHeight: "calc(100dvh - 5rem)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
              {isZh ? "屏蔽关键词" : "Mute keywords"}
            </h2>
            <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-0.5">
              {isZh
                ? "标题包含任意一个的内容会被隐藏（卡片、搜索、多源热议都生效）"
                : "Titles containing any of these are hidden across cards, search, and trending"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
            {isZh ? "关键词列表" : "Keyword list"}
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isZh ? "例如：Trump, 川普, NBA, 八卦" : "e.g. Trump, election, NBA, crypto"}
            rows={4}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors resize-none"
            autoFocus
          />
          <p className="text-[11px] text-gray-400 dark:text-zinc-600">
            {isZh
              ? "用英文逗号、中文逗号或换行分隔。匹配不区分大小写。"
              : "Comma- or newline-separated. Case-insensitive substring match."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={commit}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
          >
            {saved ? (isZh ? "已保存 ✓" : "Saved ✓") : (isZh ? "保存" : "Save")}
          </button>
          {count > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/40 transition-all"
            >
              {isZh ? "清空" : "Clear"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
