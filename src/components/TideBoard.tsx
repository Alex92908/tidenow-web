"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { SourceCard } from "./SourceCard"
import { AppleMusicCard } from "./AppleMusicCard"
import { ShareButton } from "./ShareButton"
import { TrendingTopics } from "./TrendingTopics"
import { AddFeedModal } from "./AddFeedModal"
import { sourceMeta, SOURCE_IDS, getColumns } from "@/sources/metadata"
import { getCustomFeeds, type CustomFeed } from "@/lib/custom-feeds"
import type { NewsItem, SourceColumn } from "@/lib/types"

interface SourceState {
  items: NewsItem[]
  updatedAt: number
  loading: boolean
  error: boolean
}

type PreloadedData = Record<string, { items: NewsItem[]; updatedAt: number }>

function initialState(preloaded?: PreloadedData): Record<string, SourceState> {
  return Object.fromEntries(
    SOURCE_IDS.map((id) => {
      const pre = preloaded?.[id]
      return [id, {
        items: pre?.items ?? [],
        updatedAt: pre?.updatedAt ?? 0,
        loading: !pre,
        error: false,
      }]
    })
  )
}

interface TideBoardProps {
  locale: string
  initialData?: PreloadedData
  order?: string[]
  activeFilter?: SourceColumn | "all"
  setActiveFilter?: (f: SourceColumn | "all") => void
  showTabs?: boolean
  onOpenDrawer?: () => void
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function TideBoard({
  locale,
  initialData,
  order = SOURCE_IDS,
  activeFilter: externalFilter,
  setActiveFilter: externalSetFilter,
  showTabs = false,
  onOpenDrawer,
}: TideBoardProps) {
  const t = useTranslations("sources")
  const [state, setState] = useState<Record<string, SourceState>>(() => initialState(initialData))
  const [internalFilter, setInternalFilter] = useState<SourceColumn | "all">("all")
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeFilter = externalFilter ?? internalFilter
  const setActiveFilter = externalSetFilter ?? setInternalFilter

  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Custom RSS feeds
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([])
  const [customState, setCustomState] = useState<Record<string, SourceState>>({})
  const [addFeedOpen, setAddFeedOpen] = useState(false)

  useEffect(() => {
    setCustomFeeds(getCustomFeeds())
  }, [])

  const loadCustomFeed = useCallback(async (feed: CustomFeed) => {
    setCustomState((prev) => ({ ...prev, [feed.id]: { items: [], updatedAt: 0, loading: true, error: false } }))
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`)
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      setCustomState((prev) => ({ ...prev, [feed.id]: { items: data.items, updatedAt: data.updatedAt, loading: false, error: false } }))
    } catch {
      setCustomState((prev) => ({ ...prev, [feed.id]: { items: [], updatedAt: 0, loading: false, error: true } }))
    }
  }, [])

  useEffect(() => {
    customFeeds.forEach((feed) => {
      if (!customState[feed.id]) loadCustomFeed(feed)
    })
  }, [customFeeds, customState, loadCustomFeed])

  function handleFeedsChanged() {
    const updated = getCustomFeeds()
    setCustomFeeds(updated)
    // load any new feeds
    updated.forEach((feed) => {
      if (!customState[feed.id]) loadCustomFeed(feed)
    })
  }

  const trimmed = query.trim()

  useEffect(() => {
    setCurrentIndex(0)
    scrollRef.current?.scrollTo({ left: 0, behavior: "instant" })
  }, [activeFilter])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setCurrentIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 30)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery("")
  }

  const loadSource = useCallback(async (id: string, force = false) => {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], loading: true, error: false } }))
    try {
      const res = await fetch(`/api/sources/${id}${force ? "?force=1" : ""}`)
      if (!res.ok) throw new Error("failed")
      const data = await res.json()
      setState((prev) => ({
        ...prev,
        [id]: { items: data.items, updatedAt: data.updatedAt, loading: false, error: false },
      }))
    } catch {
      setState((prev) => ({ ...prev, [id]: { ...prev[id], loading: false, error: true } }))
    }
  }, [])

  useEffect(() => {
    // Sources without SSR data fetch immediately; sources with SSR data skip initial fetch
    SOURCE_IDS.forEach((id, i) => {
      if (!initialData?.[id]) {
        setTimeout(() => loadSource(id), i * 120)
      }
    })
  }, [loadSource, initialData])

  const searchResults = useMemo(() => {
    if (!trimmed) return []
    const q = trimmed.toLowerCase()
    const results: Array<{ item: NewsItem; sourceId: string }> = []
    for (const id of SOURCE_IDS) {
      const items = state[id]?.items ?? []
      for (const item of items) {
        if (item.title.toLowerCase().includes(q)) {
          results.push({ item, sourceId: id })
        }
      }
    }
    return results.slice(0, 120)
  }, [trimmed, state])

  const columns = getColumns(locale)
  const visibleIds = activeFilter === "all"
    ? columns.flatMap((col) => order.filter((id) => sourceMeta[id]?.column === col.id))
    : order.filter((id) => sourceMeta[id]?.column === activeFilter)

  const tabs = [
    { id: "all" as const, label: locale === "zh" ? "全部" : "All" },
    ...getColumns(locale).map((c) => ({ id: c.id, label: locale === "zh" ? c.label : c.labelEn })),
  ]

  const placeholder = locale === "zh" ? "搜索所有来源..." : "Search all sources..."
  const noResults = locale === "zh" ? "没有找到相关内容" : "No results found"
  const resultCount = locale === "zh" ? `${searchResults.length} 条结果` : `${searchResults.length} results`

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar / Search bar */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {searchOpen ? (
          /* Search input — takes over the whole bar */
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-white/10">
              <svg className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-zinc-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l2.5 2.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                placeholder={placeholder}
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="shrink-0 text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors text-xs leading-none"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={closeSearch}
              className="shrink-0 text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors whitespace-nowrap"
            >
              {locale === "zh" ? "取消" : "Cancel"}
            </button>
          </div>
        ) : (
          /* Normal tab bar */
          <>
            {onOpenDrawer && (
              <button
                onClick={onOpenDrawer}
                className="md:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all text-base"
                title="来源"
              >
                ☰
              </button>
            )}
            {tabs.map((tab) => {
              const isActive = activeFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={[
                    "relative shrink-0 px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200",
                    isActive
                      ? "text-gray-900 dark:text-zinc-100 bg-gray-200 dark:bg-zinc-700/80"
                      : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60",
                  ].join(" ")}
                >
                  {tab.label}
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute inset-0 rounded-full bg-gray-200 dark:bg-zinc-700/80 -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                </button>
              )
            })}
            {/* + RSS button */}
            <button
              onClick={() => setAddFeedOpen(true)}
              className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-full text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all border border-dashed border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500"
              title={locale === "zh" ? "添加 RSS 订阅" : "Add RSS Feed"}
            >
              + RSS
            </button>

            {/* Search icon */}
            <button
              onClick={openSearch}
              className="shrink-0 ml-auto w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all"
              title={locale === "zh" ? "搜索" : "Search"}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l2.5 2.5" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Search results OR normal card grid */}
      {trimmed ? (
        <div className="flex flex-col">
          <p className="text-[11px] text-gray-400 dark:text-zinc-600 mb-2 px-0.5">
            {searchResults.length === 0 ? noResults : resultCount}
          </p>
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/[0.05] rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 overflow-hidden">
            {searchResults.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-600">
                {noResults}
              </div>
            ) : (
              searchResults.map(({ item, sourceId }) => {
                const meta = sourceMeta[sourceId]
                return (
                  <div
                    key={`${sourceId}-${item.id}`}
                    className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group"
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <span className="shrink-0 mt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white/90 ${meta?.accentColor ?? "bg-gray-400"}`}
                        >
                          <span>{meta?.icon}</span>
                          <span className="hidden sm:inline">{t(sourceId)}</span>
                        </span>
                      </span>
                      <p className="flex-1 min-w-0 text-[13px] text-gray-600 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-zinc-100 leading-snug transition-colors">
                        {highlight(item.title, trimmed)}
                      </p>
                    </a>
                    <ShareButton item={item} />
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Trending topics — shown only on "all" filter with enough loaded sources */}
          {activeFilter === "all" && (
            <TrendingTopics
              sourceData={Object.fromEntries(
                Object.entries(state)
                  .filter(([, s]) => s.items.length > 0)
                  .map(([id, s]) => [id, { items: s.items }])
              )}
              locale={locale}
            />
          )}

          {/* Cards — horizontal snap on mobile, grid on md+ */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="cards-container"
          >
            {visibleIds.map((id) => (
              <div key={id} id={`source-card-${id}`} className="card-item scroll-mt-20">
                {id === "applemusic" ? (
                  <AppleMusicCard
                    meta={sourceMeta[id]}
                    sourceName={t(id)}
                    items={state[id]?.items ?? []}
                    updatedAt={state[id]?.updatedAt ?? 0}
                    loading={state[id]?.loading ?? true}
                    error={state[id]?.error ?? false}
                    locale={locale}
                    onRefresh={() => loadSource(id, true)}
                  />
                ) : (
                  <SourceCard
                    meta={sourceMeta[id]}
                    sourceName={t(id)}
                    items={state[id]?.items ?? []}
                    updatedAt={state[id]?.updatedAt ?? 0}
                    loading={state[id]?.loading ?? true}
                    error={state[id]?.error ?? false}
                    locale={locale}
                    onRefresh={() => loadSource(id, true)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Custom RSS feed cards */}
          {customFeeds.length > 0 && activeFilter === "all" && (
            <div className="cards-container mt-0">
              {customFeeds.map((feed) => (
                <div key={feed.id} className="card-item">
                  <SourceCard
                    meta={{
                      id: feed.id,
                      icon: feed.icon,
                      accentColor: "bg-gradient-to-r from-emerald-400 to-teal-500",
                      interval: 5 * 60 * 1000,
                      defaultCount: 10,
                      expandCount: 20,
                    }}
                    sourceName={feed.title}
                    items={customState[feed.id]?.items ?? []}
                    updatedAt={customState[feed.id]?.updatedAt ?? 0}
                    loading={customState[feed.id]?.loading ?? true}
                    error={customState[feed.id]?.error ?? false}
                    locale={locale}
                    onRefresh={() => loadCustomFeed(feed)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Position indicator — mobile only */}
          {visibleIds.length > 1 && (
            <div className="flex md:hidden justify-center items-center gap-1 -mt-2">
              {visibleIds.length <= 12 ? (
                visibleIds.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollRef.current?.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: "smooth" })}
                    className={`rounded-full transition-all duration-200 ${i === currentIndex ? "w-4 h-1.5 bg-gray-400 dark:bg-zinc-300" : "w-1.5 h-1.5 bg-gray-300 dark:bg-zinc-700"}`}
                  />
                ))
              ) : (
                <span className="text-[11px] text-gray-400 dark:text-zinc-600 tabular-nums">
                  {currentIndex + 1} / {visibleIds.length}
                </span>
              )}
            </div>
          )}
        </>
      )}
    {addFeedOpen && (
      <AddFeedModal
        locale={locale}
        onClose={() => setAddFeedOpen(false)}
        onFeedsChanged={handleFeedsChanged}
      />
    )}
    </div>
  )
}
