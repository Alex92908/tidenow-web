"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { NewsItem, SourceMeta } from "@/lib/types"
import { formatDistanceToNow } from "@/lib/time"
import { ShareButton } from "@/components/ShareButton"
import { ThumbWithPreview } from "@/components/ThumbWithPreview"

type Chart = "songs" | "albums"
type Region = "us" | "gb" | "jp" | "cn"

const CHARTS: { id: Chart; en: string; zh: string }[] = [
  { id: "songs", en: "Songs", zh: "单曲" },
  { id: "albums", en: "Albums", zh: "专辑" },
]

const REGIONS: { id: Region; flag: string; en: string; zh: string }[] = [
  { id: "us", flag: "🇺🇸", en: "US", zh: "美国" },
  { id: "gb", flag: "🇬🇧", en: "UK", zh: "英国" },
  { id: "jp", flag: "🇯🇵", en: "JP", zh: "日本" },
  { id: "cn", flag: "🀄", en: "Chinese", zh: "中文" },
]

interface Props {
  meta: SourceMeta
  sourceName: string
  items: NewsItem[]
  updatedAt: number
  loading?: boolean
  error?: boolean
  locale?: string
  onRefresh: () => void
  onHide?: () => void
  isHidden?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
  /** dnd-kit listeners forwarded from SortableCard (desktop only) */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
}

export function AppleMusicCard({
  meta,
  sourceName,
  items,
  updatedAt,
  loading,
  error,
  locale = "en",
  onRefresh,
  onHide,
  isHidden,
  isPinned,
  onTogglePin,
  dragHandleProps,
}: Props) {
  const t = useTranslations("source")
  const [chart, setChart] = useState<Chart>("songs")
  const [region, setRegion] = useState<Region>("us")

  const filtered = useMemo(() => {
    const prefix = `applemusic|${chart}|${region}|`
    return items.filter((it) => it.id.startsWith(prefix)).slice(0, meta.expandCount)
  }, [items, chart, region, meta.expandCount])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 backdrop-blur shadow-sm dark:shadow-lg dark:shadow-black/30"
    >
      <div className={`h-0.5 w-full ${meta.accentColor}`} />

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{meta.icon}</span>
          <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 tracking-tight">
            {sourceName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt > 0 && (
            <span
              className="text-[11px] text-gray-400 dark:text-zinc-600"
              suppressHydrationWarning
            >
              {t("updated", { time: formatDistanceToNow(updatedAt, locale) })}
            </span>
          )}
          {/* Drag handle — desktop only, injected by SortableCard */}
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="hidden md:flex w-5 h-5 items-center justify-center rounded cursor-grab active:cursor-grabbing text-gray-300 dark:text-zinc-700 hover:text-gray-500 dark:hover:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all touch-none select-none text-sm"
              title="Drag to reorder"
            >
              ⠿
            </div>
          )}
          <button
            onClick={onRefresh}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-sm"
            title={t("retry")}
          >
            ↻
          </button>
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={[
                "w-6 h-6 flex items-center justify-center rounded-full transition-all text-xs",
                isPinned
                  ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                  : "text-gray-300 dark:text-zinc-700 hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-white/5",
              ].join(" ")}
              title={
                isPinned
                  ? (locale === "zh" ? "从自选移除" : "Unpin from Pinned")
                  : (locale === "zh" ? "加入自选" : "Pin to Pinned tab")
              }
            >
              {isPinned ? "★" : "☆"}
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className={[
                "w-6 h-6 flex items-center justify-center rounded-full transition-all text-xs",
                isHidden
                  ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                  : "text-gray-300 dark:text-zinc-700 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5",
              ].join(" ")}
              title={
                isHidden
                  ? (locale === "zh" ? "恢复到主页" : "Restore to home")
                  : (locale === "zh" ? "隐藏此来源" : "Hide this source")
              }
            >
              {isHidden ? "↩" : "✕"}
            </button>
          )}
        </div>
      </div>

      {/* Segments */}
      <div className="px-3 pt-2.5 pb-2 flex flex-col gap-1.5 border-b border-gray-100 dark:border-white/5">
        <div className="flex gap-1">
          {CHARTS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChart(c.id)}
              className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors ${
                chart === c.id
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
            >
              {locale === "zh" ? c.zh : c.en}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRegion(r.id)}
              className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors flex items-center justify-center gap-1 ${
                region === r.id
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/5"
              }`}
              title={locale === "zh" ? r.zh : r.en}
            >
              <span className="text-sm leading-none">{r.flag}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[420px] thin-scroll divide-y divide-gray-100 dark:divide-white/[0.04]">
        {loading ? (
          Array.from({ length: meta.defaultCount }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex gap-3 items-center">
              <Skeleton className="h-3 w-4 rounded bg-gray-200 dark:bg-zinc-800 shrink-0" />
              <Skeleton className="h-3 flex-1 rounded bg-gray-200 dark:bg-zinc-800" />
            </div>
          ))
        ) : error ? (
          <div className="px-4 py-10 flex flex-col items-center gap-2 text-gray-400 dark:text-zinc-500 text-sm">
            <span className="text-2xl">⚠️</span>
            <p>{t("error")}</p>
            <button
              onClick={onRefresh}
              className="text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 underline underline-offset-2"
            >
              {t("retry")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-gray-400 dark:text-zinc-500">
            {locale === "zh" ? "暂无数据" : "No data"}
          </div>
        ) : (
          filtered.map((item, i) => (
            <Row key={item.id} item={item} rank={i + 1} />
          ))
        )}
      </div>
    </motion.div>
  )
}

function Row({ item, rank }: { item: NewsItem; rank: number }) {
  const isTop3 = rank <= 3
  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-2.5 flex-1 min-w-0 items-start"
      >
        <span
          className={`text-[11px] font-mono w-4 shrink-0 mt-0.5 text-right font-bold ${
            isTop3 ? "text-orange-400" : "text-gray-300 dark:text-zinc-700"
          }`}
        >
          {rank}
        </span>
        {item.image && (
          <ThumbWithPreview src={item.image} srcLarge={item.imageLarge} size={40} />
        )}
        <p className="flex-1 min-w-0 text-[13px] text-gray-600 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-zinc-100 leading-snug line-clamp-2 transition-colors">
          {item.title}
        </p>
      </a>
      <ShareButton item={item} />
    </div>
  )
}
