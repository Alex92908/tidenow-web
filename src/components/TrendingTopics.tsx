"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { NewsItem } from "@/lib/types"
import { aggregateTrending } from "@/lib/aggregate"
import { sourceMeta } from "@/sources/metadata"

interface TrendingTopicsProps {
  sourceData: Record<string, { items: NewsItem[] }>
  locale: string
}

export function TrendingTopics({ sourceData, locale }: TrendingTopicsProps) {
  const t = useTranslations("sources")

  const topics = useMemo(() => aggregateTrending(sourceData, 2, 8), [sourceData])

  if (topics.length === 0) return null

  const heading = locale === "zh" ? "多源热议" : "Trending Across Sources"

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 backdrop-blur shadow-sm dark:shadow-lg dark:shadow-black/30 overflow-hidden">
      {/* Accent bar — multi-color gradient */}
      <div className="h-0.5 w-full bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500" />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <span className="text-base leading-none">🔥</span>
        <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 tracking-tight">
          {heading}
        </span>
        <span className="ml-auto text-[11px] text-gray-400 dark:text-zinc-600">
          {locale === "zh" ? `${topics.length} 个热议话题` : `${topics.length} hot topics`}
        </span>
      </div>

      {/* Topics list */}
      <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
        {topics.map((topic, i) => {
          const best = topic.mentions.reduce((a, b) => (a.rank < b.rank ? a : b))
          const uniqueSources = [...new Set(topic.mentions.map((m) => m.sourceId))].slice(0, 4)

          return (
            <a
              key={topic.keyword}
              href={best.item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group"
            >
              {/* Rank */}
              <span
                className={`text-[11px] font-mono w-4 shrink-0 mt-0.5 text-right font-bold ${
                  i < 3 ? "text-orange-400" : "text-gray-300 dark:text-zinc-700"
                }`}
              >
                {i + 1}
              </span>

              {/* Title + source badges */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-gray-600 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-zinc-100 leading-snug line-clamp-2 transition-colors">
                  {topic.displayTitle}
                </p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {uniqueSources.map((sid) => {
                    const meta = sourceMeta[sid]
                    return (
                      <span
                        key={sid}
                        className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white/90 ${meta?.accentColor ?? "bg-gray-400"}`}
                      >
                        <span>{meta?.icon}</span>
                        <span className="hidden sm:inline">{t(sid)}</span>
                      </span>
                    )
                  })}
                  {topic.mentions.length > 4 && (
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600">
                      +{topic.mentions.length - 4}
                    </span>
                  )}
                  {/* Heat score */}
                  <span className="ml-auto text-[10px] text-orange-400 font-medium tabular-nums">
                    🔥 {topic.score}
                  </span>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
