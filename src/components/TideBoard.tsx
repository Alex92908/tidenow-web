"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { SourceCard } from "./SourceCard"
import { AppleMusicCard } from "./AppleMusicCard"
import { ShareButton } from "./ShareButton"
import { TrendingTopics } from "./TrendingTopics"
import { AddFeedModal } from "./AddFeedModal"
import { sourceMeta, SOURCE_IDS, getColumns } from "@/sources/metadata"
import { getCustomFeeds, type CustomFeed } from "@/lib/custom-feeds"
import type { NewsItem, FilterId } from "@/lib/types"

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
  setOrder?: (next: string[]) => void
  orderDirty?: boolean
  onResetOrder?: () => void
  activeFilter?: FilterId
  setActiveFilter?: (f: FilterId) => void
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
  setOrder,
  orderDirty = false,
  onResetOrder,
  activeFilter: externalFilter,
  setActiveFilter: externalSetFilter,
  showTabs = false,
  onOpenDrawer,
}: TideBoardProps) {
  const t = useTranslations("sources")
  const [state, setState] = useState<Record<string, SourceState>>(() => initialState(initialData))
  const [internalFilter, setInternalFilter] = useState<FilterId>("all")
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeFilter = externalFilter ?? internalFilter
  const setActiveFilter = externalSetFilter ?? setInternalFilter

  // User-hidden source ids (persisted in localStorage). Starts empty on both
  // server and first client render to avoid hydration mismatch; the effect
  // then hydrates from localStorage on the client.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tidenow-hidden-sources")
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHiddenIds(new Set(JSON.parse(raw) as string[]))
      }
    } catch {
      // ignore (Safari private mode etc.)
    }
  }, [])
  const persistHidden = useCallback((next: Set<string>) => {
    setHiddenIds(next)
    try {
      localStorage.setItem("tidenow-hidden-sources", JSON.stringify([...next]))
    } catch {
      // ignore
    }
  }, [])
  const toggleHide = useCallback(
    (id: string) => {
      const next = new Set(hiddenIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persistHidden(next)
    },
    [hiddenIds, persistHidden]
  )

  // Hide/show the "Trending Across Sources" panel
  const [trendingHidden, setTrendingHidden] = useState(false)
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrendingHidden(localStorage.getItem("tidenow-trending-hidden") === "1")
    } catch {
      // ignore
    }
  }, [])
  const persistTrendingHidden = useCallback((v: boolean) => {
    setTrendingHidden(v)
    try {
      if (v) localStorage.setItem("tidenow-trending-hidden", "1")
      else localStorage.removeItem("tidenow-trending-hidden")
    } catch {
      // ignore
    }
  }, [])

  // User-pinned source ids (favorites tab). Independent of hide/order.
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tidenow-favorite-sources")
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFavoriteIds(new Set(JSON.parse(raw) as string[]))
      }
    } catch {
      // ignore
    }
  }, [])
  const persistFavorites = useCallback((next: Set<string>) => {
    setFavoriteIds(next)
    try {
      localStorage.setItem("tidenow-favorite-sources", JSON.stringify([...next]))
    } catch {
      // ignore
    }
  }, [])
  const togglePin = useCallback(
    (id: string) => {
      const next = new Set(favoriteIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persistFavorites(next)
    },
    [favoriteIds, persistFavorites]
  )

  // Whether the user has reordered cards away from the default. We only know
  // this is "non-default" if the parent provided onResetOrder *and* the order
  // prop differs from SOURCE_IDS — but the cheap heuristic below (compare to
  // sorted-by-id) would be wrong for SOURCE_IDS_EN/ZH which are intentional.
  // Simplest signal: assume order is non-default whenever onResetOrder is
  // provided and the parent tells us (we expose a single "reset" button; the
  // parent can clear localStorage itself, or we can call onResetOrder which
  // makes them snap back to defaultOrder).
  // For visibility, track this via the parent: TideApp passes onResetOrder
  // and is responsible for knowing if order != default.
  const resetLayout = useCallback(() => {
    onResetOrder?.()
    persistHidden(new Set())
    persistFavorites(new Set())
    persistTrendingHidden(false)
  }, [onResetOrder, persistHidden, persistFavorites, persistTrendingHidden])

  // Reorder via @dnd-kit. Called when the user drops a card on a new slot.
  // Writes through to the single shared `order` (lives in TideApp); the sidebar
  // listens to the same state, so both views stay in sync.
  const reorderSource = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId || !setOrder) return
      const working = [...order]
      for (const id of SOURCE_IDS) if (!working.includes(id)) working.push(id)
      const fromIdx = working.indexOf(fromId)
      const toIdx = working.indexOf(toId)
      if (fromIdx === -1 || toIdx === -1) return
      setOrder(arrayMove(working, fromIdx, toIdx))
    },
    [order, setOrder]
  )

  // dnd-kit setup
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const dndSensors = useSensors(
    // 6px movement threshold so single-clicks on links/buttons don't start a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 250ms long-press on touch before drag starts (lets normal taps through)
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDndDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
  }, [])
  const onDndDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = e
      if (over && active.id !== over.id) {
        reorderSource(String(active.id), String(over.id))
      }
    },
    [reorderSource]
  )

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

  // Eager-load all sources on mount: missing SSR data → fetch now; stale SSR
  // data → refresh in background; fresh → no-op (display SSR snapshot until
  // next user-triggered refresh).
  useEffect(() => {
    SOURCE_IDS.forEach((id, i) => {
      const pre = initialData?.[id]
      const interval = sourceMeta[id]?.interval ?? 5 * 60 * 1000
      const isStale = pre && Date.now() - pre.updatedAt > interval
      if (!pre || isStale) {
        setTimeout(() => loadSource(id), i * 120)
      }
    })
  }, [initialData, loadSource])

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
  const visibleIds = useMemo(
    () => {
      // `order` is the canonical user order (from TideApp + sidebar drag).
      let base: string[]
      if (activeFilter === "all") {
        base = columns.flatMap((col) => order.filter((id) => sourceMeta[id]?.column === col.id))
      } else if (activeFilter === "favorites") {
        // Pinned sources only — don't apply hide filter (if user pinned it
        // explicitly, "show" wins over "hide").
        return order.filter((id) => favoriteIds.has(id))
      } else if (activeFilter === "hidden") {
        // Hidden tab — show ONLY hidden sources so user can restore them.
        return order.filter((id) => hiddenIds.has(id))
      } else {
        base = order.filter((id) => sourceMeta[id]?.column === activeFilter)
      }
      return base.filter((id) => !hiddenIds.has(id))
    },
    [activeFilter, columns, order, hiddenIds, favoriteIds]
  )

  const hiddenLabel = locale === "zh" ? "隐藏" : "Hidden"
  const tabs: { id: FilterId; label: string }[] = [
    { id: "all", label: locale === "zh" ? "全部" : "All" },
    { id: "favorites", label: locale === "zh" ? "自选" : "Pinned" },
    ...getColumns(locale).map((c) => ({ id: c.id, label: locale === "zh" ? c.label : c.labelEn })),
    { id: "hidden", label: hiddenIds.size > 0 ? `${hiddenLabel} (${hiddenIds.size})` : hiddenLabel },
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

            {/* Reset layout — shown right-aligned in tab bar only when state is non-default */}
            {(hiddenIds.size > 0 || orderDirty || favoriteIds.size > 0 || trendingHidden) && (
              <button
                onClick={resetLayout}
                className="shrink-0 ml-auto h-8 px-2.5 flex items-center gap-1 rounded-full text-[11px] text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all"
                title={locale === "zh" ? "重置自定义布局（顺序 / 自选 / 隐藏）" : "Reset custom layout (order / pinned / hidden)"}
              >
                <span className="text-xs leading-none">↺</span>
                <span className="hidden sm:inline">{locale === "zh" ? "重置" : "Reset"}</span>
              </button>
            )}

            {/* Search icon */}
            <button
              onClick={openSearch}
              className={[
                "shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all",
                (hiddenIds.size > 0 || orderDirty || favoriteIds.size > 0 || trendingHidden) ? "" : "ml-auto",
              ].join(" ")}
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
          {activeFilter === "all" && !trendingHidden && (
            <TrendingTopics
              sourceData={Object.fromEntries(
                Object.entries(state)
                  .filter(([, s]) => s.items.length > 0)
                  .map(([id, s]) => [id, { items: s.items }])
              )}
              locale={locale}
              onHide={() => persistTrendingHidden(true)}
            />
          )}
          {activeFilter === "all" && trendingHidden && (
            <button
              onClick={() => persistTrendingHidden(false)}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-[11px] text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-all"
            >
              <span>🔥</span>
              <span>
                {locale === "zh" ? "多源热议已隐藏 · 点击显示" : "Trending hidden · click to show"}
              </span>
            </button>
          )}

          {/* Empty states for favorites / hidden tabs */}
          {activeFilter === "favorites" && visibleIds.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 px-6 py-12 text-center text-sm text-gray-500 dark:text-zinc-500">
              <p className="text-base mb-2">★</p>
              <p>
                {locale === "zh"
                  ? "还没有自选来源。在任意卡片右上角点 ★ 添加。"
                  : "No pinned sources yet. Tap ★ on any card header to add one."}
              </p>
            </div>
          )}
          {activeFilter === "hidden" && visibleIds.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 px-6 py-12 text-center text-sm text-gray-500 dark:text-zinc-500">
              <p>
                {locale === "zh"
                  ? "当前没有隐藏的来源。在任意卡片右上角点 ✕ 即可隐藏。"
                  : "No hidden sources. Tap ✕ on any card header to hide it."}
              </p>
            </div>
          )}

          {/* Cards — horizontal snap on mobile, grid on md+; wrapped in
              DndContext so cards are sortable via @dnd-kit (auto-scroll,
              touch, keyboard, ghost overlay all built in). */}
          <DndContext
            id="source-board-dnd"
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragStart={onDndDragStart}
            onDragEnd={onDndDragEnd}
          >
            <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="cards-container"
              >
                {visibleIds.map((id) => (
                  <SortableCard key={id} id={id}>
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
                        onHide={() => toggleHide(id)}
                        isHidden={hiddenIds.has(id)}
                        isPinned={favoriteIds.has(id)}
                        onTogglePin={() => togglePin(id)}
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
                        onHide={() => toggleHide(id)}
                        isHidden={hiddenIds.has(id)}
                        isPinned={favoriteIds.has(id)}
                        onTogglePin={() => togglePin(id)}
                      />
                    )}
                  </SortableCard>
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 200 }}>
              {activeDragId ? (
                activeDragId === "applemusic" ? (
                  <AppleMusicCard
                    meta={sourceMeta[activeDragId]}
                    sourceName={t(activeDragId)}
                    items={state[activeDragId]?.items ?? []}
                    updatedAt={state[activeDragId]?.updatedAt ?? 0}
                    loading={state[activeDragId]?.loading ?? true}
                    error={state[activeDragId]?.error ?? false}
                    locale={locale}
                    onRefresh={() => {}}
                  />
                ) : (
                  <SourceCard
                    meta={sourceMeta[activeDragId]}
                    sourceName={t(activeDragId)}
                    items={state[activeDragId]?.items ?? []}
                    updatedAt={state[activeDragId]?.updatedAt ?? 0}
                    loading={state[activeDragId]?.loading ?? true}
                    error={state[activeDragId]?.error ?? false}
                    locale={locale}
                    onRefresh={() => {}}
                  />
                )
              ) : null}
            </DragOverlay>
          </DndContext>

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

// Wraps a card in the dnd-kit sortable transform / drag listeners.
// The card stays in flow while not being dragged; the active card is
// rendered translucent so the <DragOverlay> can carry its visual.
function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`source-card-${id}`}
      className="card-item scroll-mt-20 touch-none"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
