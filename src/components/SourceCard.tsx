"use client"

import { useState } from "react"
import { useAISummary } from "@/lib/use-ai-summary"
import { getAISettings } from "@/lib/ai-settings"
import { useTranslations } from "next-intl"
import { motion, type Variants } from "framer-motion"
import type { NewsItem, SourceMeta } from "@/lib/types"
import { formatDistanceToNow } from "@/lib/time"
import { sourceMeta } from "@/sources/metadata"
import { ShareButton } from "@/components/ShareButton"
import { ThumbWithPreview } from "@/components/ThumbWithPreview"
import { AISettingsModal } from "@/components/AISettingsModal"

// Staggered entrance: the delay lives in the variant (mount only) so
// drag-reorder layout shifts stay instant — a delay on the root
// `transition` prop would make every reorder lag.
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      delay: Math.min(i * 0.04, 0.4),
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

// Skeleton title widths cycle so loading rows look like real headlines
// instead of identical bars.
const SKELETON_WIDTHS = [88, 64, 76, 58, 82, 70]

interface SourceCardProps {
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
  /** dnd-kit listeners + attributes forwarded from SortableCard (desktop only) */
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  /** Position in the visible grid — drives the entrance stagger. */
  index?: number
}

export function SourceCard({
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
  index = 0,
}: SourceCardProps) {
  const t = useTranslations("source")

  const visible = items.slice(0, meta.expandCount)

  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="hidden"
      animate="show"
      custom={index}
      transition={{ layout: { duration: 0.2, ease: "easeOut" } }}
      className="flex flex-col rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 backdrop-blur shadow-sm dark:shadow-lg dark:shadow-black/30 hover:shadow-lg hover:shadow-gray-200/70 dark:hover:shadow-black/40 hover:border-gray-300 dark:hover:border-white/10 transition-shadow duration-200"
    >
      {/* Accent bar */}
      <div className={`h-0.5 w-full ${meta.accentColor}`} />

      {/* Header — two rows so long source names don't squeeze the actions.
          Row 1: icon + name (+ updated-at on the right).
          Row 2: drag handle / share / refresh / pin / hide, right-aligned. */}
      <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center justify-between gap-2 min-w-0">
          {/* Source name links to its per-source page — but only for
              built-in sources (custom RSS feeds have no /source/{id}
              page, so they keep the plain-text header). */}
          {sourceMeta[meta.id] ? (
            <a
              href={locale === "zh" ? `/zh/source/${meta.id}` : `/source/${meta.id}`}
              title={locale === "zh" ? "查看来源页" : "View source page"}
              className="group flex items-center gap-2 min-w-0"
            >
              <span className="text-lg leading-none shrink-0">{meta.icon}</span>
              <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 tracking-tight truncate group-hover:underline underline-offset-2 decoration-sky-500">
                {sourceName}
              </span>
              <span aria-hidden className="text-xs text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                →
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg leading-none shrink-0">{meta.icon}</span>
              <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 tracking-tight truncate">
                {sourceName}
              </span>
            </div>
          )}
          {updatedAt > 0 && (
            <span
              className="text-[11px] text-gray-400 dark:text-zinc-600 shrink-0 whitespace-nowrap"
              suppressHydrationWarning
            >
              {t("updated", { time: formatDistanceToNow(updatedAt, locale) })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-1.5">
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
          <ShareButton
            item={{
              title: `${sourceName} · TideNow`,
              url:
                (typeof window !== "undefined" ? window.location.origin : "https://www.tide-now.com") +
                (locale === "zh" ? `/zh/source/${meta.id}` : `/source/${meta.id}`),
            }}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 dark:text-zinc-700 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          />
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

      {/* Items */}
      <div className="overflow-y-auto max-h-[420px] thin-scroll divide-y divide-gray-100 dark:divide-white/[0.04]">
        {loading ? (
          // Shimmer skeleton that matches the row layout (rank + title),
          // with varying title widths so it reads as arriving headlines.
          Array.from({ length: meta.defaultCount }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex gap-3 items-center">
              <div className="skeleton-shimmer h-3 w-4 rounded shrink-0" />
              <div
                className="skeleton-shimmer h-3 rounded"
                style={{ width: `${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}%` }}
              />
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
        ) : visible.length === 0 ? (
          // Not an error, but nothing to show — e.g. a source whose feed
          // legitimately has no items right now. Say so explicitly
          // instead of rendering a bare header with an empty body.
          <div className="px-4 py-10 flex flex-col items-center gap-2 text-gray-400 dark:text-zinc-500 text-sm">
            <span className="text-2xl">📭</span>
            <p>{t("empty")}</p>
            <button
              onClick={onRefresh}
              className="text-xs text-gray-400 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 underline underline-offset-2"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          visible.map((item, i) => (
            <NewsItemRow
              key={item.id}
              item={item}
              rank={i + 1}
              accentColor={meta.accentColor}
              icon={meta.icon}
              locale={locale}
            />
          ))
        )}
      </div>
    </motion.div>
  )
}

function NewsItemRow({
  item,
  rank,
  accentColor,
  icon,
  locale,
}: {
  item: NewsItem
  rank: number
  accentColor: string
  icon: string
  locale: string
}) {
  const isTop3 = rank <= 3
  const { summary, loading: summaryLoading, hoverProps, trigger } = useAISummary(item.title, locale)
  // No AI key configured? Open the settings modal right here, in place —
  // the old behaviour showed a text hint ("go set it in ✦ above") that
  // sent the user hunting for a tiny icon. Every other BYO-key product
  // (Vibedit, Devin) puts the setup affordance at the point of use:
  // one click instead of five.
  const [settingsOpen, setSettingsOpen] = useState(false)
  function handleAiClick() {
    if (summary || summaryLoading) return
    if (!getAISettings()) {
      setSettingsOpen(true)
      return
    }
    trigger()
  }

  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group"
      {...hoverProps}
    >
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-2.5 flex-1 min-w-0 items-start"
        // Let users drag-select the headline to copy it: if there's an
        // active text selection on click, suppress navigation so the
        // select-then-release gesture doesn't open the link.
        onClick={(e) => {
          if (window.getSelection()?.toString()) e.preventDefault()
        }}
      >
        <span
          className={`text-[11px] font-mono w-4 shrink-0 mt-0.5 text-right font-bold ${
            isTop3 ? "text-orange-400" : "text-gray-300 dark:text-zinc-700"
          }`}
        >
          {rank}
        </span>
        {item.image ? (
          <ThumbWithPreview src={item.image} srcLarge={item.imageLarge} size={40} />
        ) : (
          // No thumbnail from the upstream: a gradient tile in the
          // source's own accent colors + icon, so every row has the
          // same 40px visual anchor instead of a ragged left edge.
          <span
            aria-hidden
            className={`w-10 h-10 shrink-0 rounded-md ${accentColor} flex items-center justify-center text-base leading-none`}
          >
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {/* No line-clamp — the title shows in full and the row height
              grows to fit. select-text makes the headline drag-selectable
              even though it lives inside the link. */}
          <p className="text-gray-600 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-zinc-100 leading-snug select-text transition-colors" style={{ fontSize: "var(--news-font-size, 13px)" }}>
            {item.title}
          </p>
          {/* AI summary — shown on hover */}
          {summaryLoading && (
            <p className="text-[11px] text-sky-400/60 mt-0.5 animate-pulse">
              {locale === "zh" ? "AI 解读中…" : "AI summarizing…"}
            </p>
          )}
          {summary && !summaryLoading && (
            <p className="text-[11px] text-sky-500 dark:text-sky-400 mt-0.5 leading-snug select-text">
              ✦ {summary}
            </p>
          )}
          {item.extra && !summary && (
            <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-0.5 leading-snug select-text">{item.extra}</p>
          )}
        </div>
      </a>
      {/* Visible AI affordance — hover alone never taught users summaries
          exist. Click fires the same summary immediately; hidden once the
          summary is showing. */}
      {!summary && (
        <button
          type="button"
          onClick={handleAiClick}
          disabled={summaryLoading}
          title={locale === "zh" ? "AI 解读这条标题" : "AI summary for this headline"}
          className="shrink-0 self-start mt-0.5 px-1.5 py-0.5 rounded-md border border-sky-200 dark:border-sky-500/30 text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors disabled:opacity-60"
        >
          {summaryLoading ? "✦ …" : "✦ AI"}
        </button>
      )}
      <ShareButton item={item} />
      {settingsOpen && <AISettingsModal locale={locale} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

