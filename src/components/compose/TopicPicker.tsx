"use client"

import { useMemo, useState } from "react"
// useState is still used below for the keyword search box.
import type { NewsItem } from "@/lib/types"
import { materialFromItem, type DraftMaterial } from "@/lib/compose-storage"

interface Props {
  initialData: Record<string, { items: NewsItem[]; updatedAt: number }>
  sourceNames: Record<string, string>
  selected: DraftMaterial[]
  onChange: (next: DraftMaterial[]) => void
  /** Source filter is controlled by the parent so the auto-pick flow can
   *  pre-select the chips that the picked materials came from. */
  sourceFilter: Set<string>
  onSourceFilterChange: (next: Set<string>) => void
  locale: "en" | "zh"
}

const MAX_SELECTED = 5

// Left column, two equal halves:
//   1. Multi-select source chip pane (top half, wrappable + scrollable)
//   2. Topic list filtered by union of picked sources (bottom half)
// An empty source set = "show all" — same as the All chip being active.
export function TopicPicker({
  initialData,
  sourceNames,
  selected,
  onChange,
  sourceFilter,
  onSourceFilterChange,
  locale,
}: Props) {
  const [keyword, setKeyword] = useState("")

  const sources = useMemo(() => {
    return Object.entries(initialData)
      .filter(([, v]) => v?.items?.length > 0)
      .sort((a, b) => {
        // localeCompare's default-locale behaviour differs between Node
        // (en-US on most Linux hosts) and the browser (user's system
        // locale). When the page server-renders in one order and the
        // client re-orders during hydration, React throws a hydration
        // mismatch (we saw exactly this with Anthropic vs 爱奇艺). Use a
        // plain code-point comparison — deterministic everywhere, and
        // it naturally puts Latin source names before CJK ones, which
        // happens to be the order most users expect.
        const na = sourceNames[a[0]] ?? a[0]
        const nb = sourceNames[b[0]] ?? b[0]
        return na < nb ? -1 : na > nb ? 1 : 0
      })
  }, [initialData, sourceNames])

  const showAll = sourceFilter.size === 0
  const showingCount = showAll ? sources.length : sourceFilter.size

  const selectedRefs = useMemo(() => new Set(selected.map((s) => s.ref)), [selected])
  const atMax = selected.length >= MAX_SELECTED

  // Build the visible list. Two passes so the picked items always sit at
  // the top, even when they'd otherwise be hidden by the current filter
  // / keyword / per-source cap. Without this, the auto-picked materials
  // get lost in a list of 300+ items and the user can't even see what
  // was chosen for them.
  const flat = useMemo(() => {
    const out: { sourceId: string; item: NewsItem; pinned: boolean }[] = []
    const seen = new Set<string>()

    // Pass 1: selected items, in pick order — always visible.
    for (const m of selected) {
      // Reconstruct a NewsItem shape from the stored material; the
      // source name lives elsewhere but the picker only needs id/title/url.
      const item: NewsItem = {
        id: m.ref.split(":").slice(1).join(":") || m.ref,
        title: m.title,
        url: m.url,
        extra: m.extra,
        image: m.image,
      }
      out.push({ sourceId: m.sourceId, item, pinned: true })
      seen.add(m.ref)
    }

    // Pass 2: the filtered trending pool, skipping anything already
    // pinned at the top.
    for (const [sourceId, { items }] of sources) {
      if (!showAll && !sourceFilter.has(sourceId)) continue
      // When the user has narrowed to ≤3 sources, give them the full
      // depth. When they're skimming all 60+, show only the top of each
      // feed so the list stays scannable.
      const cap = showAll ? 5 : sourceFilter.size <= 3 ? 30 : 10
      for (const it of items.slice(0, cap)) {
        const ref = `${sourceId}:${it.id}`
        if (seen.has(ref)) continue
        out.push({ sourceId, item: it, pinned: false })
      }
    }

    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      // Keyword filter never hides pinned items — the user needs to keep
      // seeing what they picked even while searching for something else.
      return out.filter(
        ({ item, pinned }) =>
          // 同 TideBoard：不假设上游一定给 title
          pinned || (typeof item.title === "string" && item.title.toLowerCase().includes(kw))
      )
    }
    return out
  }, [sources, sourceFilter, showAll, keyword, selected])

  function toggleSource(id: string) {
    const next = new Set(sourceFilter)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSourceFilterChange(next)
  }

  function toggleItem(sourceId: string, item: NewsItem) {
    const ref = `${sourceId}:${item.id}`
    if (selectedRefs.has(ref)) {
      onChange(selected.filter((s) => s.ref !== ref))
    } else if (!atMax) {
      const name = sourceNames[sourceId] ?? sourceId
      onChange([...selected, materialFromItem(sourceId, name, item)])
    }
  }

  const empty = sources.length === 0

  return (
    // Grid with two equal-fraction rows for the chip pane and the topic
    // list, plus auto rows for the search bar and section headers. The
    // two 1fr rows split the remaining vertical space evenly.
    <div className="grid grid-rows-[auto_auto_1fr_auto_1fr] h-full min-h-0 gap-2">
      {/* Search + counter */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={locale === "zh" ? "搜索关键词…" : "Search keyword…"}
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
        <span
          className={`text-[11px] tabular-nums shrink-0 ${
            selected.length === MAX_SELECTED ? "text-rose-500" : "text-gray-400 dark:text-zinc-500"
          }`}
        >
          {selected.length}/{MAX_SELECTED}
        </span>
      </div>

      {/* Source pane header */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
          {locale === "zh" ? "📚 信息源" : "📚 Sources"}
          {!showAll && (
            <span className="ml-1 text-gray-400 dark:text-zinc-600 normal-case">
              · {locale === "zh" ? `已选 ${showingCount} 个` : `${showingCount} picked`}
            </span>
          )}
        </span>
        {!showAll && (
          <button
            type="button"
            onClick={() => onSourceFilterChange(new Set())}
            className="text-gray-400 dark:text-zinc-600 hover:text-sky-500 transition-colors"
          >
            {locale === "zh" ? "重置为全部" : "Reset"}
          </button>
        )}
      </div>

      {/* Source chip pane — wrappable + internally scrollable, takes top half */}
      <div className="overflow-y-auto rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/40 p-2">
        {empty ? (
          <p className="text-center text-xs text-gray-400 dark:text-zinc-600 py-6 leading-relaxed">
            {locale === "zh" ? (
              <>
                还没有源数据
                <br />
                请先打开 <a href="/zh" className="underline hover:text-sky-500">首页</a> 加载一次
              </>
            ) : (
              <>
                No source data yet
                <br />
                Open the <a href="/" className="underline hover:text-sky-500">home page</a> first to load it
              </>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={showAll}
              onClick={() => onSourceFilterChange(new Set())}
              label={locale === "zh" ? "全部" : "All"}
            />
            {sources.map(([sourceId]) => (
              <FilterChip
                key={sourceId}
                active={sourceFilter.has(sourceId)}
                onClick={() => toggleSource(sourceId)}
                label={sourceNames[sourceId] ?? sourceId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Topic list header */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
          {locale === "zh" ? "🔥 热点话题" : "🔥 Trending topics"}
          <span className="ml-1 text-gray-400 dark:text-zinc-600 normal-case">· {flat.length}</span>
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-gray-400 dark:text-zinc-600 hover:text-rose-500 transition-colors"
          >
            {locale === "zh" ? "清空所选" : "Clear picks"}
          </button>
        )}
      </div>

      {/* Topic list — bottom half */}
      <ol className="overflow-y-auto rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/40 divide-y divide-gray-100 dark:divide-white/[0.04]">
        {flat.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-gray-400 dark:text-zinc-600">
            {locale === "zh" ? "没有匹配的条目" : "Nothing matches"}
          </li>
        ) : (
          flat.map(({ sourceId, item, pinned }, idx) => {
            const ref = `${sourceId}:${item.id}`
            const isSel = selectedRefs.has(ref)
            const disabled = atMax && !isSel
            // Drop a faint separator after the pinned selections so the
            // user can visually parse "these are my picks · these are
            // other trends".
            const isLastPinned =
              pinned && (idx === flat.length - 1 || !flat[idx + 1].pinned)
            return (
              <li
                key={ref}
                className={`group flex items-stretch ${
                  isLastPinned ? "border-b-2 border-sky-200/60 dark:border-sky-500/20" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleItem(sourceId, item)}
                  disabled={disabled}
                  className={`flex-1 min-w-0 text-left px-3 py-2 text-xs leading-snug transition-colors flex items-start gap-2 ${
                    isSel
                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : disabled
                        ? "opacity-40 cursor-not-allowed text-gray-500 dark:text-zinc-500"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.03] text-gray-700 dark:text-zinc-300"
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 text-base leading-none ${isSel ? "" : "opacity-30"}`} aria-hidden>
                    {isSel ? "☑" : "☐"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600 mr-1.5">
                      {sourceNames[sourceId] ?? sourceId}
                    </span>
                    {item.title}
                  </span>
                </button>
                {/* Copy-title-only button — the row itself is a toggle so
                    text selection is blocked; this gives the user a one-
                    click way to grab just the headline. */}
                <CopyTitleButton title={item.title} locale={locale} />
              </li>
            )
          })
        )}
      </ol>
    </div>
  )
}

function CopyTitleButton({ title, locale }: { title: string; locale: "en" | "zh" }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(title)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      title={locale === "zh" ? "复制标题" : "Copy title"}
      className="shrink-0 px-2 text-[11px] text-gray-300 dark:text-zinc-700 hover:text-sky-500 transition-colors opacity-0 group-hover:opacity-100"
    >
      {copied ? "✓" : "📋"}
    </button>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] transition-colors ${
        active
          ? "bg-sky-500 text-white"
          : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  )
}
