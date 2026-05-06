"use client"

import { useState, useEffect } from "react"
import {
  type AIProvider,
  type AISettings,
  PROVIDER_META,
  getAISettings,
  saveAISettings,
  clearAISettings,
} from "@/lib/ai-settings"

interface AISettingsModalProps {
  onClose: () => void
  locale: string
}

const PROVIDERS = Object.keys(PROVIDER_META) as AIProvider[]

export function AISettingsModal({ onClose, locale }: AISettingsModalProps) {
  const isZh = locale === "zh"
  const [provider, setProvider] = useState<AIProvider>("anthropic")
  const [apiKey, setApiKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)

  useEffect(() => {
    const s = getAISettings()
    if (s) {
      setProvider(s.provider)
      setApiKey(s.apiKey)
      setHasSaved(true)
    }
  }, [])

  function handleSave() {
    if (!apiKey.trim()) return
    saveAISettings({ provider, apiKey: apiKey.trim() })
    setSaved(true)
    setHasSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  function handleClear() {
    clearAISettings()
    setApiKey("")
    setHasSaved(false)
  }

  const meta = PROVIDER_META[provider]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
              {isZh ? "AI 摘要设置" : "AI Summary Settings"}
            </h2>
            <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-0.5">
              {isZh
                ? "悬停新闻条目时，AI 自动生成一句话背景解读"
                : "Hover over any news item to get a one-sentence AI context"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Provider selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
            {isZh ? "服务商" : "Provider"}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={[
                  "px-3 py-2 rounded-xl text-[12px] font-medium border transition-all text-left",
                  provider === p
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-white/20",
                ].join(" ")}
              >
                {PROVIDER_META[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
              API Key
            </label>
            <a
              href={meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-sky-500 hover:underline"
            >
              {isZh ? "获取 Key →" : "Get Key →"}
            </a>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={meta.placeholder}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors"
          />
          <p className="text-[11px] text-gray-400 dark:text-zinc-600">
            {isZh
              ? "Key 仅存储在本地浏览器，不上传服务器"
              : "Key is stored locally in your browser only"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saved ? (isZh ? "已保存 ✓" : "Saved ✓") : (isZh ? "保存" : "Save")}
          </button>
          {hasSaved && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-white/10 hover:border-red-300 dark:hover:border-red-500/40 transition-all"
            >
              {isZh ? "清除" : "Clear"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
