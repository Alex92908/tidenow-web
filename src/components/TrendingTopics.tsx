"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { NewsItem } from "@/lib/types"
import { aggregateTrending, type TrendingTopic } from "@/lib/aggregate"
import { useAISummary } from "@/lib/use-ai-summary"

interface TrendingTopicsProps {
  sourceData: Record<string, { items: NewsItem[] }>
  locale: string
  onHide?: () => void
}

export function TrendingTopics({ sourceData, locale, onHide }: TrendingTopicsProps) {
  const t = useTranslations("sources")

  // aggregateTrending returns ~24 candidates across both languages; we present
  // an 80/20 mix favoring the user's locale: 6 of the user's language plus 2
  // cross-language picks out of 8 total. Falls back to whichever side has more
  // when one side is short (e.g., quiet English news day on zh locale).
  const allTopics = useMemo(() => aggregateTrending(sourceData, 2, 8), [sourceData])
  const TOTAL = 8
  const PRIMARY_QUOTA = 6 // 80% of 8 ≈ 6
  const topics = useMemo(() => {
    const wantLang: "zh" | "en" = locale === "zh" ? "zh" : "en"
    const primary = allTopics.filter((t) => t.lang === wantLang)
    const secondary = allTopics.filter((t) => t.lang !== wantLang)
    const primaryPicked = primary.slice(0, PRIMARY_QUOTA)
    const secondaryPicked = secondary.slice(0, TOTAL - primaryPicked.length)
    let merged = [...primaryPicked, ...secondaryPicked]
    // If still short (e.g. primary < 6 AND secondary < 2), top up from
    // whichever leftover bucket has more.
    if (merged.length < TOTAL) {
      const used = new Set(merged.map((t) => t.keyword))
      const leftover = allTopics.filter((t) => !used.has(t.keyword))
      merged = [...merged, ...leftover.slice(0, TOTAL - merged.length)]
    }
    // Preserve overall hotness order across the mix so the top slot is the
    // hottest topic (regardless of language), not always a primary-language one.
    return merged.sort((a, b) => b.score - a.score)
  }, [allTopics, locale])

  if (topics.length === 0) return null

  const heading = locale === "zh" ? "多源热议" : "Trending Across Sources"

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 backdrop-blur shadow-sm dark:shadow-lg dark:shadow-black/30 overflow-hidden">
      {/* No rainbow accent strip on top — same coloured-line motif as the
          source cards (lee: "卡片上面是一条横线"). The panel is plain. */}

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <span className="text-base leading-none">🔥</span>
        <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 tracking-tight">
          {heading}
        </span>
        <span className="ml-auto text-[11px] text-gray-400 dark:text-zinc-600">
          {locale === "zh" ? `${topics.length} 个热议话题` : `${topics.length} hot topics`}
        </span>
        {onHide && (
          <button
            onClick={onHide}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 dark:text-zinc-700 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-xs"
            title={locale === "zh" ? "隐藏多源热议" : "Hide trending"}
          >
            ✕
          </button>
        )}
      </div>

      {/* Topics list */}
      <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
        {topics.map((topic, i) => (
          <TopicRow key={topic.keyword} topic={topic} rank={i + 1} locale={locale} />
        ))}
      </div>
    </div>
  )
}

function TopicRow({ topic, rank, locale }: { topic: TrendingTopic; rank: number; locale: string }) {
  const t = useTranslations("sources")
  const best = topic.mentions.reduce((a, b) => (a.rank < b.rank ? a : b))
  // Per-source best URL — clicking a source badge opens THAT source's
  // version of the story, not the overall winner's URL.
  const bestPerSource = new Map<string, string>()
  for (const m of topic.mentions) {
    if (!bestPerSource.has(m.sourceId)) bestPerSource.set(m.sourceId, m.item.url)
  }
  const sourceLinks = Array.from(bestPerSource.entries()).slice(0, 4)

  // AI summary — lazy-loaded on hover (after 600ms dwell so a quick scan
  // doesn't fan out a wall of API calls). Same plumbing as SourceCard rows.
  const { summary, loading: summaryLoading, hoverProps } = useAISummary(
    topic.displayTitle,
    locale
  )

  return (
    <div
      {...hoverProps}
      className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
    >
      {/* Rank */}
      <span
        className={`text-[11px] font-mono w-4 shrink-0 mt-0.5 text-right font-bold ${
          rank <= 3 ? "text-orange-400" : "text-gray-300 dark:text-zinc-700"
        }`}
      >
        {rank}
      </span>

      {/* Title + source badges */}
      <div className="flex-1 min-w-0">
        {/* Title link → the highest-ranked mention overall */}
        <a
          href={best.item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[13px] text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 leading-snug line-clamp-2 transition-colors"
        >
          {topic.displayTitle}
        </a>
        {/* AI summary — appears on hover when the user has a key configured */}
        {summaryLoading && (
          <p className="text-[11px] text-sky-400/60 mt-0.5 animate-pulse">
            {locale === "zh" ? "AI 解读中…" : "AI summarizing…"}
          </p>
        )}
        {summary && !summaryLoading && (
          <p className="text-[11px] text-sky-500 dark:text-sky-400 mt-0.5 leading-snug">
            ✦ {summary}
          </p>
        )}
        {/* Sources carrying this story — plain muted text, not coloured
            pills. The old chips were a gradient pill per source (up to 4
            different colours + emoji per row), the loudest element in the
            panel; the headline is what matters. */}
        <div className="flex items-center gap-1 mt-1 flex-wrap text-[11px] text-gray-400 dark:text-zinc-500">
          {sourceLinks.map(([sid, url], i) => (
            <span key={sid} className="inline-flex items-center gap-1">
              {i > 0 && <span aria-hidden>·</span>}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={t(sid)}
                className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
              >
                {t(sid)}
              </a>
            </span>
          ))}
          {topic.mentions.length > 4 && (
            <span>· +{topic.mentions.length - 4}</span>
          )}
          {/* Heat score — quiet: a plain muted number, no flame emoji. */}
          <span className="ml-auto tabular-nums">
            {topic.score}
          </span>
        </div>
      </div>
    </div>
  )
}
