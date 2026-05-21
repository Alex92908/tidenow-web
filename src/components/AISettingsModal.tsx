"use client"

import { useState, useEffect } from "react"
import {
  type AIProvider,
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

async function checkGeminiNano(): Promise<"ready" | "downloading" | "unavailable"> {
  try {
    // @ts-expect-error Chrome AI API not yet in TS lib
    const cap = await window?.ai?.languageModel?.capabilities?.()
    if (!cap) return "unavailable"
    if (cap.available === "readily") return "ready"
    if (cap.available === "after-download") return "downloading"
    return "unavailable"
  } catch {
    return "unavailable"
  }
}

export function AISettingsModal({ onClose, locale }: AISettingsModalProps) {
  const isZh = locale === "zh"
  const [provider, setProvider] = useState<AIProvider>("gemini-nano")
  const [apiKey, setApiKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [nanoStatus, setNanoStatus] = useState<"ready" | "downloading" | "unavailable" | "checking">("checking")

  useEffect(() => {
    const s = getAISettings()
    if (s) {
      setProvider(s.provider)
      setApiKey(s.apiKey)
      setHasSaved(true)
    }
    checkGeminiNano().then(setNanoStatus)
  }, [])

  function handleProviderSelect(p: AIProvider) {
    setProvider(p)
    if (p === "gemini-nano") {
      saveAISettings({ provider: p, apiKey: "" })
      setHasSaved(true)
    }
  }

  function handleSave() {
    const meta = PROVIDER_META[provider]
    if (!meta.local && !apiKey.trim()) return
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
  const isLocal = !!meta.local

  const nanoLabel = {
    ready: isZh ? "✓ 可用" : "✓ Available",
    downloading: isZh ? "⏳ 下载中…" : "⏳ Downloading…",
    unavailable: isZh ? "✕ 不支持" : "✕ Not supported",
    checking: "…",
  }[nanoStatus]

  const nanoColor = {
    ready: "text-emerald-500",
    downloading: "text-amber-500",
    unavailable: "text-red-400",
    checking: "text-gray-400",
  }[nanoStatus]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl p-6 flex flex-col gap-5 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 5rem)' }}>

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
            {PROVIDERS.map((p) => {
              const pm = PROVIDER_META[p]
              return (
                <button
                  key={p}
                  onClick={() => handleProviderSelect(p)}
                  className={[
                    "relative px-3 py-2 rounded-xl text-[12px] font-medium border transition-all text-left",
                    provider === p
                      ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
                      : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-white/20",
                  ].join(" ")}
                >
                  {pm.local && (
                    <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                      FREE
                    </span>
                  )}
                  {pm.label}
                  {p === "gemini-nano" && (
                    <span className={`block text-[10px] mt-0.5 ${nanoColor}`}>
                      {nanoLabel}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Gemini Nano info or API Key */}
        {isLocal ? (
          <div className="rounded-xl border border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-zinc-800/50 p-3 flex flex-col gap-1.5 text-[12px]">
            {nanoStatus === "unavailable" ? (
              <>
                <p className="text-gray-500 dark:text-zinc-400 font-medium">
                  {isZh ? "如何启用 Gemini Nano" : "How to enable Gemini Nano"}
                </p>
                <ol className="text-gray-400 dark:text-zinc-500 space-y-1 list-decimal list-inside">
                  <li>{isZh ? "需要 Chrome 139–147 桌面版" : "Chrome 139–147 desktop required"}</li>
                  <li>
                    {isZh ? "打开 " : "Open "}
                    <code className="bg-gray-100 dark:bg-zinc-700 px-1 rounded text-[11px]">
                      chrome://flags/#prompt-api-for-gemini-nano
                    </code>
                  </li>
                  <li>{isZh ? "设置为 Enabled，重启 Chrome" : "Set to Enabled, restart Chrome"}</li>
                </ol>
                <a
                  href="https://developer.chrome.com/docs/ai/built-in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:underline mt-0.5"
                >
                  {isZh ? "了解更多 →" : "Learn more →"}
                </a>
              </>
            ) : nanoStatus === "downloading" ? (
              <p className="text-amber-500">
                {isZh
                  ? "Chrome 正在后台下载 Gemini Nano 模型，完成后即可使用"
                  : "Chrome is downloading Gemini Nano in the background. Ready shortly."}
              </p>
            ) : (
              <p className="text-emerald-600 dark:text-emerald-400">
                {isZh
                  ? "✓ Gemini Nano 已就绪。完全本地运行，零成本、完全隐私"
                  : "✓ Gemini Nano is ready — runs fully on-device, free & private."}
              </p>
            )}
          </div>
        ) : (
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
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isLocal ? (
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
            >
              {isZh ? "完成" : "Done"}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              {saved ? (isZh ? "已保存 ✓" : "Saved ✓") : (isZh ? "保存" : "Save")}
            </button>
          )}
          {hasSaved && !isLocal && (
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
