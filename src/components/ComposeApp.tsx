"use client"

import { useEffect, useMemo, useState } from "react"
import type { NewsItem } from "@/lib/types"
import {
  type Draft,
  type DraftMaterial,
  type DraftStyle,
  deleteDraft,
  listDrafts,
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
  const compose = useAICompose()

  // Hydrate from localStorage on mount. If the user has drafts, open the
  // most recent one; otherwise start a fresh blank.
  useEffect(() => {
    const all = listDrafts()
    setDrafts(all)
    if (all.length > 0) {
      const d = all[0]
      loadDraft(d)
    } else {
      const blank = emptyDraft(locale)
      setCurrentId(blank.id)
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
  }

  function handlePickDraft(id: string) {
    const d = drafts.find((x) => x.id === id)
    if (d) loadDraft(d)
  }

  function handleNewDraft() {
    const blank = emptyDraft(locale)
    setCurrentId(blank.id)
    setMaterials([])
    setStyle("deep")
    setCustomPrompt("")
    setMarkdown("")
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
      locale,
    }
    const next = saveDraft(draft)
    setDrafts(next)
  }

  function handleGenerate() {
    if (materials.length === 0) return
    compose.generate({ style, customPrompt, materials, locale })
  }

  const canSave = useMemo(() => markdown.trim().length > 0 || materials.length > 0, [markdown, materials])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_220px] gap-4 h-[calc(100vh-7rem)]">
      {/* LEFT: topic picker + style + generate */}
      <div className="flex flex-col gap-3 min-h-0">
        <StylePicker value={style} customPrompt={customPrompt} onChange={(s, c) => { setStyle(s); if (c !== undefined) setCustomPrompt(c) }} locale={locale} />
        <div className="flex-1 min-h-0">
          <TopicPicker
            initialData={initialData}
            sourceNames={sourceNames}
            selected={materials}
            onChange={setMaterials}
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
