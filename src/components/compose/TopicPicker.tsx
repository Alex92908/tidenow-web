"use client"

import { useMemo, useState } from "react"
import type { NewsItem } from "@/lib/types"
import { materialFromItem, type DraftMaterial } from "@/lib/compose-storage"

interface Props {
  initialData: Record<string, { items: NewsItem[]; updatedAt: number }>
  sourceNames: Record<string, string>
  selected: DraftMaterial[]
  onChange: (next: DraftMaterial[]) => void
  locale: "en" | "zh"
}

const MAX_SELECTED = 5

// Left column: source filter chips + keyword search + a scrollable list of
// trending items pulled from initialData (the same SSR'd snapshot the home
// page uses). Click an item to toss it into the materials basket; click
// again to remove. Capped at MAX_SELECTED so the AI doesn't get a
// dumptruck of context.
export function TopicPicker({
  initialData,
  sourceNames,
  selected,
  onChange,
  locale,
}: Props) {
  const [filter, setFilter] = useState<string>("all")
  const [keyword, setKeyword] = useState("")

  const sources = useMemo(() => {
    return Object.entries(initialData)
      .filter(([, v]) => v?.items?.length > 0)
      .sort((a, b) => (sourceNames[a[0]] ?? a[0]).localeCompare(sourceNames[b[0]] ?? b[0]))
  }, [initialData, sourceNames])

  const flat = useMemo(() => {
    const all: { sourceId: string; item: NewsItem }[] = []
    for (const [sourceId, { items }] of sources) {
      if (filter !== "all" && filter !== sourceId) continue
      // Cap per-source so a single feed (Weibo, with 50 items) doesn't
      // drown the list when "all" is selected.
      const cap = filter === "all" ? 8 : 30
      for (const it of items.slice(0, cap)) all.push({ sourceId, item: it })
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      return all.filter(({ item }) => item.title.toLowerCase().includes(kw))
    }
    return all
  }, [sources, filter, keyword])

  const selectedRefs = useMemo(() => new Set(selected.map((s) => s.ref)), [selected])
  const atMax = selected.length >= MAX_SELECTED

  function toggle(sourceId: string, item: NewsItem) {
    const ref = `${sourceId}:${item.id}`
    if (selectedRefs.has(ref)) {
      onChange(selected.filter((s) => s.ref !== ref))
    } else if (!atMax) {
      const name = sourceNames[sourceId] ?? sourceId
      onChange([...selected, materialFromItem(sourceId, name, item)])
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={locale === "zh" ? "搜索关键词…" : "Search keyword…"}
        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
      />

      {/* Source filter chips */}
      <div className="flex flex-wrap gap-1 mt-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={locale === "zh" ? "全部" : "All"}
        />
        {sources.map(([sourceId]) => (
          <FilterChip
            key={sourceId}
            active={filter === sourceId}
            onClick={() => setFilter(sourceId)}
            label={sourceNames[sourceId] ?? sourceId}
          />
        ))}
      </div>

      {/* Selected count */}
      <div className="mt-3 mb-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-500">
        <span>
          {locale === "zh"
            ? `已选 ${selected.length}/${MAX_SELECTED} 条素材`
            : `Selected ${selected.length}/${MAX_SELECTED}`}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-gray-400 dark:text-zinc-600 hover:text-rose-500 transition-colors"
          >
            {locale === "zh" ? "清空" : "Clear"}
          </button>
        )}
      </div>

      {/* List */}
      <ol className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/40 divide-y divide-gray-100 dark:divide-white/[0.04]">
        {flat.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-gray-400 dark:text-zinc-600">
            {locale === "zh" ? "没有匹配的条目" : "Nothing matches"}
          </li>
        ) : (
          flat.map(({ sourceId, item }) => {
            const ref = `${sourceId}:${item.id}`
            const isSel = selectedRefs.has(ref)
            const disabled = atMax && !isSel
            return (
              <li key={ref}>
                <button
                  type="button"
                  onClick={() => toggle(sourceId, item)}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-2 text-xs leading-snug transition-colors ${
                    isSel
                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : disabled
                        ? "opacity-40 cursor-not-allowed text-gray-500 dark:text-zinc-500"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.03] text-gray-700 dark:text-zinc-300"
                  }`}
                >
                  <span className="text-[10px] text-gray-400 dark:text-zinc-600 mr-1.5">
                    {sourceNames[sourceId] ?? sourceId}
                  </span>
                  {item.title}
                </button>
              </li>
            )
          })
        )}
      </ol>
    </div>
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
      className={`px-2 py-0.5 rounded-full text-[11px] transition-colors ${
        active
          ? "bg-sky-500 text-white"
          : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  )
}
