"use client"

import { useEffect, useMemo, useState } from "react"
import type { NewsItem } from "@/lib/types"
import { aggregateTrending } from "@/lib/aggregate"
import {
  type Draft,
  type DraftMaterial,
  type DraftStyle,
  deleteDraft,
  listDrafts,
  materialFromItem,
  newDraftId,
  saveDraft,
} from "@/lib/compose-storage"
import { useAICompose } from "@/lib/use-ai-compose"
import { TopicPicker } from "@/components/compose/TopicPicker"
import { StylePicker } from "@/components/compose/StylePicker"
import { DraftEditor } from "@/components/compose/DraftEditor"
import { DraftList } from "@/components/compose/DraftList"
import { ExportButtons } from "@/components/compose/ExportButtons"

interface Props {
  locale: "en" | "zh"
  initialData: Record<string, { items: NewsItem[]; updatedAt: number }>
  sourceNames: Record<string, string>
}

const emptyDraft = (locale: "en" | "zh"): Draft => ({
  id: newDraftId(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  preview: "",
  style: "deep",
  customPrompt: "",
  materials: [],
  markdown: "",
  locale,
})

export function ComposeApp({ locale, initialData, sourceNames }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [materials, setMaterials] = useState<DraftMaterial[]>([])
  const [style, setStyle] = useState<DraftStyle>("deep")
  const [customPrompt, setCustomPrompt] = useState("")
  const [markdown, setMarkdown] = useState("")
  // Output language for the AI — independent of the page locale. Defaults
  // to whatever the page locale is, but the user can flip it.
  const [outputLocale, setOutputLocale] = useState<"en" | "zh">(locale)
  // Source filter chips, lifted up so the auto-pick path can pre-select
  // the chips that materials came from.
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())
  const [autoPicked, setAutoPicked] = useState(false)
  const compose = useAICompose()

  // Seed a fresh draft with the top cross-source trending clusters — same
  // logic the home page's "Trending Across Sources" panel uses. These are
  // the highest-signal stories (appearing in 2+ feeds), so they're the
  // sanest default vs. forcing the user to manually scan 60+ sources.
  const suggestedMaterials = useMemo(() => {
    const topics = aggregateTrending(initialData, 2, 5)
    const out: DraftMaterial[] = []
    const seen = new Set<string>()
    for (const t of topics) {
      const m = t.mentions[0]
      if (!m) continue
      const ref = `${m.sourceId}:${m.item.id}`
      if (seen.has(ref)) continue
      seen.add(ref)
      const name = sourceNames[m.sourceId] ?? m.sourceId
      out.push(materialFromItem(m.sourceId, name, m.item))
      if (out.length >= 5) break
    }
    return out
  }, [initialData, sourceNames])

  // Hydrate from localStorage on mount. If the user has drafts, open the
  // most recent one; otherwise start fresh and pre-fill cross-source
  // trending picks.
  useEffect(() => {
    const all = listDrafts()
    setDrafts(all)
    if (all.length > 0) {
      const d = all[0]
      loadDraft(d)
    } else {
      const blank = emptyDraft(locale)
      setCurrentId(blank.id)
      if (suggestedMaterials.length > 0) {
        setMaterials(suggestedMaterials)
        // Mirror the source filter to the sources we just auto-picked
        // from. This way the "📚 Sources" chip pane reflects current
        // context: All is unhighlighted, the source chips for the picks
        // are blue, and the trending list naturally narrows to nearby
        // candidates if the user wants to swap.
        setSourceFilter(new Set(suggestedMaterials.map((m) => m.sourceId)))
        setAutoPicked(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the AI returns a new article, replace the editor contents and
  // reset the hook so subsequent edits aren't shadowed by it.
  useEffect(() => {
    if (compose.markdown) {
      setMarkdown(compose.markdown)
      compose.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compose.markdown])

  function loadDraft(d: Draft) {
    setCurrentId(d.id)
    setMaterials(d.materials)
    setStyle(d.style)
    setCustomPrompt(d.customPrompt ?? "")
    setMarkdown(d.markdown)
    // Restore the draft's saved output language; older drafts that don't
    // have one fall back to the page locale.
    setOutputLocale(d.locale ?? locale)
    // Reflect the draft's materials in the source-chip selection.
    setSourceFilter(new Set(d.materials.map((m) => m.sourceId)))
    setAutoPicked(false)
  }

  function handlePickDraft(id: string) {
    const d = drafts.find((x) => x.id === id)
    if (d) loadDraft(d)
  }

  function handleNewDraft() {
    const blank = emptyDraft(locale)
    setCurrentId(blank.id)
    setStyle("deep")
    setCustomPrompt("")
    setMarkdown("")
    // Same auto-pick treatment as the cold-start case — keeps "+ New"
    // useful instead of dropping the user on an empty canvas.
    if (suggestedMaterials.length > 0) {
      setMaterials(suggestedMaterials)
      setSourceFilter(new Set(suggestedMaterials.map((m) => m.sourceId)))
      setAutoPicked(true)
    } else {
      setMaterials([])
      setSourceFilter(new Set())
      setAutoPicked(false)
    }
  }

  // Any manual change to the materials means the user has taken over —
  // dismiss the "auto-picked" hint so it doesn't lie about the state.
  function handleMaterialsChange(next: DraftMaterial[]) {
    setMaterials(next)
    setAutoPicked(false)
  }

  function handleDeleteDraft(id: string) {
    const next = deleteDraft(id)
    setDrafts(next)
    if (id === currentId) {
      if (next.length > 0) loadDraft(next[0])
      else handleNewDraft()
    }
  }

  function handleSave() {
    if (!currentId) return
    if (!markdown.trim() && materials.length === 0) return
    const existing = drafts.find((d) => d.id === currentId)
    const draft: Draft = {
      id: currentId,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      preview: "",
      style,
      customPrompt,
      materials,
      markdown,
      locale: outputLocale,
    }
    const next = saveDraft(draft)
    setDrafts(next)
  }

  function handleGenerate() {
    if (materials.length === 0) return
    compose.generate({ style, customPrompt, materials, locale: outputLocale })
  }

  const canSave = useMemo(() => markdown.trim().length > 0 || materials.length > 0, [markdown, materials])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_220px] gap-4 h-[calc(100vh-7rem)]">
      {/* LEFT: topic picker + style + generate */}
      <div className="flex flex-col gap-3 min-h-0">
        {/* Output language toggle — decoupled from page locale so a
            Chinese-UI user can author English drafts and vice versa. */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-semibold">
            {locale === "zh" ? "输出语言" : "Output"}
          </span>
          <div className="flex rounded-md border border-gray-200 dark:border-white/10 p-0.5">
            {(["en", "zh"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setOutputLocale(l)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  outputLocale === l
                    ? "bg-sky-500 text-white"
                    : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                }`}
              >
                {l === "en" ? "EN" : "中文"}
              </button>
            ))}
          </div>
        </div>
        <StylePicker value={style} customPrompt={customPrompt} onChange={(s, c) => { setStyle(s); if (c !== undefined) setCustomPrompt(c) }} locale={locale} />
        {autoPicked && materials.length > 0 && (
          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-[11px] text-sky-700 dark:text-sky-300 leading-snug">
            <span aria-hidden>📍</span>
            <span className="flex-1">
              {locale === "zh"
                ? `已自动选中 ${materials.length} 条跨源热点，可调整`
                : `Pre-filled with ${materials.length} cross-source trends — adjust as needed`}
            </span>
            <button
              type="button"
              onClick={() => handleMaterialsChange([])}
              className="text-sky-500 hover:text-sky-700 dark:hover:text-sky-200"
              title={locale === "zh" ? "清空重选" : "Clear"}
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <TopicPicker
            initialData={initialData}
            sourceNames={sourceNames}
            selected={materials}
            onChange={handleMaterialsChange}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            locale={locale}
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={materials.length === 0 || compose.loading}
          className="w-full px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {compose.loading
            ? locale === "zh" ? "✦ 生成中…" : "✦ Generating…"
            : locale === "zh" ? "✦ 一键生成" : "✦ Generate"}
        </button>
        {compose.error && (
          <p className="text-[11px] text-rose-500 leading-snug">{compose.error}</p>
        )}
      </div>

      {/* CENTER: editor + preview */}
      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex-1 min-h-0">
          <DraftEditor value={markdown} onChange={setMarkdown} loading={compose.loading} locale={locale} />
        </div>
        <div className="flex items-center justify-between gap-2 shrink-0">
          <ExportButtons markdown={markdown} locale={locale} />
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            💾 {locale === "zh" ? "保存到草稿箱" : "Save draft"}
          </button>
        </div>
      </div>

      {/* RIGHT: drafts list */}
      <div className="flex flex-col min-h-0">
        <DraftList
          drafts={drafts}
          currentId={currentId}
          onPick={handlePickDraft}
          onDelete={handleDeleteDraft}
          onNew={handleNewDraft}
          onImported={setDrafts}
          locale={locale}
        />
      </div>
    </div>
  )
}
