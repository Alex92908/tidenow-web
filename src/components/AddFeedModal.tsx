"use client"

import { useState } from "react"
import { addCustomFeed, getCustomFeeds, removeCustomFeed, type CustomFeed } from "@/lib/custom-feeds"

const ICONS = ["📰","🗞️","📡","🔗","🌐","💡","🔬","🎮","🎵","💹","🏆","🌍"]

interface AddFeedModalProps {
  locale: string
  onClose: () => void
  onFeedsChanged: () => void
}

export function AddFeedModal({ locale, onClose, onFeedsChanged }: AddFeedModalProps) {
  const isZh = locale === "zh"
  const [url, setUrl] = useState("")
  const [icon, setIcon] = useState("📰")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [feeds, setFeeds] = useState<CustomFeed[]>(() => getCustomFeeds())

  async function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error(isZh ? "无法读取该 RSS 地址" : "Could not fetch RSS feed")
      const data = await res.json()
      if (data.items?.length === 0) throw new Error(isZh ? "未找到条目" : "No items found")

      const feed: CustomFeed = {
        id: `rss-${Date.now()}`,
        url: trimmed,
        title: data.title ?? "RSS Feed",
        icon,
      }
      addCustomFeed(feed)
      setFeeds(getCustomFeeds())
      setUrl("")
      onFeedsChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleRemove(id: string) {
    removeCustomFeed(id)
    setFeeds(getCustomFeeds())
    onFeedsChanged()
  }

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
              {isZh ? "添加 RSS 订阅" : "Add RSS Feed"}
            </h2>
            <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-0.5">
              {isZh ? "任何 RSS / Atom 地址均可" : "Any RSS or Atom feed URL"}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-sm">✕</button>
        </div>

        {/* Icon picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
            {isZh ? "图标" : "Icon"}
          </label>
          <div className="flex gap-2 flex-wrap">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                  icon === ic
                    ? "bg-sky-100 dark:bg-sky-500/20 ring-2 ring-sky-400"
                    : "hover:bg-gray-100 dark:hover:bg-white/10"
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* URL input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
            RSS URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError("") }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="https://example.com/feed.xml"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!url.trim() || loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
            >
              {loading ? "…" : (isZh ? "添加" : "Add")}
            </button>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        {/* Existing feeds */}
        {feeds.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
              {isZh ? "已订阅" : "Subscribed"}
            </label>
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/[0.05] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              {feeds.map((feed) => (
                <div key={feed.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="text-base shrink-0">{feed.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 dark:text-zinc-200 truncate">{feed.title}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-600 truncate">{feed.url}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(feed.id)}
                    className="shrink-0 text-gray-300 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
