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
import { PublishButton } from "@/components/compose/PublishButton"

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
  // ForeSight opt-in: when on, the lead material is run through the
  // prediction engine and its calibrated analysis grounds a
  // forward-looking section in the article.
  //
  // Shown by default now that the deployment runs a 60s function budget
  // (Hobby supports maxDuration 60). It's still behind a kill switch:
  // set NEXT_PUBLIC_FORESIGHT_ENABLED=0 to hide the toggle if the engine
  // turns out to time out in practice (ForeSight ~20-40s + the article
  // ~20-50s run sequentially and a slow run can exceed 60s).
  const foresightEnabled = process.env.NEXT_PUBLIC_FORESIGHT_ENABLED !== "0"
  const [useForesight, setUseForesight] = useState(false)
  // Source filter chips, lifted up so the auto-pick path can pre-select
  // the chips that materials came from.
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())
  const [autoPicked, setAutoPicked] = useState(false)
  // Snapshot taken at last save / load — drives the "Unsaved" indicator
  // and the leave-page guards. Initialised once the mount auto-pick
  // settles so the baseline reflects the canvas the user sees first.
  const [baseline, setBaseline] = useState<string | null>(null)
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

  // Stable JSON snapshot of "what the user has authored". Used to detect
  // dirty state. We deliberately exclude `currentId` and `autoPicked` —
  // those describe session bookkeeping, not user content. materials are
  // serialised by ref so the comparison ignores reconstructed-NewsItem
  // object identity changes.
  function makeSnapshot(
    m: DraftMaterial[],
    md: string,
    st: DraftStyle,
    cp: string,
    ol: "en" | "zh"
  ): string {
    return JSON.stringify({
      materials: m.map((x) => x.ref),
      markdown: md,
      style: st,
      customPrompt: cp,
      outputLocale: ol,
    })
  }
  const currentSnapshot = makeSnapshot(materials, markdown, style, customPrompt, outputLocale)
  const isDirty = baseline !== null && currentSnapshot !== baseline

  // Every entry into /compose starts on a fresh canvas with the current
  // moment's cross-source picks. The previous behavior — auto-loading the
  // most recent saved draft — felt like reopening a stale tab: users came
  // back wanting to write about today's trends, not edit yesterday's piece.
  // Old drafts remain visible in the right-hand panel and one click away.
  useEffect(() => {
    setDrafts(listDrafts())
    const blank = emptyDraft(locale)
    setCurrentId(blank.id)
    const initialMaterials =
      suggestedMaterials.length > 0 ? suggestedMaterials : []
    if (initialMaterials.length > 0) {
      setMaterials(initialMaterials)
      // Mirror the source filter to the sources we just auto-picked
      // from. The "📚 Sources" chip pane now reflects current context:
      // All is unhighlighted, the source chips for the picks are blue,
      // and the trending list naturally narrows to nearby candidates
      // if the user wants to swap.
      setSourceFilter(new Set(initialMaterials.map((m) => m.sourceId)))
      setAutoPicked(true)
    }
    // Establish baseline AFTER the auto-pick settles. The auto-picked
    // materials are "what the user opened to" — they aren't unsaved
    // changes themselves; only edits *on top* of this baseline are.
    setBaseline(makeSnapshot(initialMaterials, "", "deep", "", locale))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // beforeunload guard — fires on tab close, refresh, and external nav.
  // Browsers ignore the custom string (they show their generic "Leave
  // site?" prompt), but setting returnValue is what arms the prompt.
  useEffect(() => {
    if (!isDirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = "" // Required for Chrome to actually prompt.
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  // In-app nav guard — intercepts clicks on same-origin <a> elements
  // when there are unsaved changes. Next.js Link uses pushState, which
  // doesn't trigger beforeunload, so without this the ← TideNow link in
  // the page header would silently dump the draft. We attach in the
  // capture phase so we beat the App Router's own click handler.
  useEffect(() => {
    if (!isDirty) return
    function onClick(e: MouseEvent) {
      // Only handle plain left-clicks; let modifier-clicks (open-in-tab)
      // and middle-clicks pass through untouched.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest("a")
      if (!a) return
      const href = a.getAttribute("href")
      if (!href || href.startsWith("#") || a.getAttribute("download") !== null) return
      if (a.target === "_blank") return
      // Resolve absolute URL to check it's same-origin and a real
      // navigation away from /compose.
      let dest: URL
      try {
        dest = new URL(href, window.location.href)
      } catch {
        return
      }
      if (dest.origin !== window.location.origin) return
      if (dest.pathname === window.location.pathname) return

      const msg =
        locale === "zh"
          ? "有未保存的修改。要保存草稿后再离开吗？\n\n确定 = 保存并离开\n取消 = 留下继续编辑"
          : "Unsaved changes. Save the draft before leaving?\n\nOK = save and leave\nCancel = stay and keep editing"
      const choice = window.confirm(msg)
      if (choice) {
        // Save synchronously, then continue the navigation. handleSave
        // writes to localStorage immediately (no awaitable IO), so by the
        // time we return the data is persisted.
        e.preventDefault()
        e.stopPropagation()
        handleSave()
        window.location.href = dest.href
      } else {
        // User chose to stay. Cancel the navigation.
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
    // handleSave is stable enough across renders that re-binding on its
    // identity flip is fine; isDirty is the meaningful trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, locale])

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
    const ol = d.locale ?? locale
    setOutputLocale(ol)
    // Reflect the draft's materials in the source-chip selection.
    setSourceFilter(new Set(d.materials.map((m) => m.sourceId)))
    setAutoPicked(false)
    // Loaded == clean.
    setBaseline(makeSnapshot(d.materials, d.markdown, d.style, d.customPrompt ?? "", ol))
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
    setBaseline(currentSnapshot)
  }

  // Snapshot the current editor into a brand-new draft entry. Used when
  // the user has regenerated content on top of a previously-saved draft
  // and wants to keep BOTH versions instead of overwriting.
  function handleSaveAsNew() {
    if (!markdown.trim() && materials.length === 0) return
    const newId = newDraftId()
    const draft: Draft = {
      id: newId,
      createdAt: Date.now(),
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
    setCurrentId(newId)
    setBaseline(currentSnapshot)
  }

  // Whether the current id corresponds to a draft that's already been
  // saved. Drives the Save button's wording so the user can tell at a
  // glance whether they're updating or creating.
  const isCurrentSaved = useMemo(
    () => drafts.some((d) => d.id === currentId),
    [drafts, currentId]
  )

  function handleGenerate() {
    if (materials.length === 0) return
    compose.generate({ style, customPrompt, materials, locale: outputLocale, foresight: useForesight })
  }

  const canSave = useMemo(() => markdown.trim().length > 0 || materials.length > 0, [markdown, materials])

  return (
    // Desktop: 3-column grid with a single-viewport fixed height so each
    // column scrolls independently. Mobile: stack vertically and let the
    // page itself scroll — fixing the height to 100vh-7rem stuffed the
    // three sections into ~33% of the viewport each and the chip pane,
    // topic list, editor, and bottom action row all visually overlapped.
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_220px] gap-4 lg:h-[calc(100vh-7rem)]">
      {/* LEFT: topic picker + style + generate. On mobile this becomes
          one of three stacked sections, so give the topic-picker box a
          real height (h-[60vh]) — without it the wrapping chip pane and
          the topic list each collapsed to almost nothing and the
          Generate button visually overlapped the chips. */}
      <div className="flex flex-col gap-3 lg:min-h-0">
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
        {/* ForeSight prediction toggle — gated behind the build-time flag
            (hidden on the Hobby plan where the 10s function limit would
            always time the engine out). When on, the lead trending item is
            run through the prediction engine and the article grounds a
            forward-looking section in its calibrated analysis. */}
        {foresightEnabled && (
          <button
            type="button"
            onClick={() => setUseForesight((v) => !v)}
            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
              useForesight
                ? "border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
                : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-zinc-500 hover:border-gray-300 dark:hover:border-white/20"
            }`}
            title={
              locale === "zh"
                ? "用 ForeSight 预测引擎分析头条素材，在文章里加入前瞻判断"
                : "Run the lead item through the ForeSight prediction engine to ground a forward-looking section"
            }
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden>🔮</span>
              {locale === "zh" ? "ForeSight 预测增强" : "ForeSight prediction"}
            </span>
            <span
              className={`relative inline-block w-7 h-4 rounded-full transition-colors ${
                useForesight ? "bg-violet-500" : "bg-gray-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  useForesight ? "translate-x-3" : ""
                }`}
              />
            </span>
          </button>
        )}
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
        {/* Material-discipline hint. Picking many unrelated items forces
            the AI to stitch them under a vague umbrella theme, which is
            exactly what produces "on one hand / on the other hand" filler.
            Surface a gentle nudge past 2 items. */}
        {materials.length > 2 && (
          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
            <span aria-hidden>💡</span>
            <span className="flex-1">
              {locale === "zh"
                ? `选了 ${materials.length} 条。素材越多越杂，文章越容易写成空泛议论。想要深度建议聚焦 1-2 条相关的。`
                : `${materials.length} picked. More unrelated items push the article toward vague "on one hand…" filler — for depth, focus on 1-2 related ones.`}
            </span>
          </div>
        )}
        <div className="h-[60vh] lg:h-auto lg:flex-1 lg:min-h-0">
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
            ? useForesight
              ? locale === "zh" ? "🔮 预测 + 生成中…" : "🔮 Predicting + writing…"
              : locale === "zh" ? "✦ 生成中…" : "✦ Generating…"
            : locale === "zh" ? "✦ 一键生成" : "✦ Generate"}
        </button>
        {useForesight && !compose.loading && (
          <p className="text-[11px] text-violet-500 dark:text-violet-400 leading-snug">
            {locale === "zh"
              ? "🔮 已开启预测增强,生成会多花 20-40 秒"
              : "🔮 Prediction on — generation takes 20-40s longer"}
          </p>
        )}
        {compose.error && (
          <p className="text-[11px] text-rose-500 leading-snug">{compose.error}</p>
        )}
      </div>

      {/* CENTER: editor + preview */}
      <div className="flex flex-col gap-2 lg:min-h-0">
        <div className="h-[60vh] lg:h-auto lg:flex-1 lg:min-h-0">
          <DraftEditor value={markdown} onChange={setMarkdown} loading={compose.loading} locale={locale} />
        </div>
        {/* Bottom action row — on mobile we let it wrap so the seven
            buttons (copy/share/publish/save) stack into multiple lines
            rather than squishing every label vertically. */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <ExportButtons markdown={markdown} locale={locale} />
          <div className="flex items-center gap-1.5">
            {/* Dirty indicator — quiet amber dot when there are pending
                edits, so the user sees the state at a glance before
                clicking anything that might navigate away. */}
            {isDirty && (
              <span
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-amber-600 dark:text-amber-400"
                title={locale === "zh" ? "有未保存的修改" : "Unsaved changes"}
              >
                <span aria-hidden className="text-base leading-none">●</span>
                {locale === "zh" ? "未保存" : "Unsaved"}
              </span>
            )}
            <CopyMarkdownButton markdown={markdown} locale={locale} />
            <ShareArticleButton markdown={markdown} locale={locale} />
            <PublishButton markdown={markdown} outputLocale={outputLocale} uiLocale={locale} />
            {isCurrentSaved && (
              <button
                type="button"
                onClick={handleSaveAsNew}
                disabled={!canSave}
                className="px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={locale === "zh" ? "保留旧版本，把当前内容存成新一条" : "Keep the old version; save current as a new entry"}
              >
                📄 {locale === "zh" ? "另存为新" : "Save as new"}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                isCurrentSaved
                  ? locale === "zh"
                    ? "覆盖当前草稿"
                    : "Overwrite the current saved draft"
                  : undefined
              }
            >
              💾 {isCurrentSaved
                ? locale === "zh" ? "更新当前" : "Update"
                : locale === "zh" ? "保存草稿" : "Save draft"}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: drafts list. Mobile gets a capped height so a long
          drafts list doesn't push the rest of the page off-screen. */}
      <div className="flex flex-col h-[40vh] lg:h-auto lg:min-h-0">
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

// Opens the system share sheet (Web Share API) with a title derived from
// the first # heading and the article's body as text. On desktops without
// share support, falls back to copying a share-friendly snippet —
// "title\n\nfirst-paragraph\n\n[…] · via TideNow" — so the click is never
// a no-op.
function ShareArticleButton({ markdown, locale }: { markdown: string; locale: "en" | "zh" }) {
  const [done, setDone] = useState<"shared" | "copied" | null>(null)
  const empty = !markdown.trim()

  function deriveTitle(): string {
    const h1 = markdown.match(/^#\s+(.+)$/m)
    if (h1) return h1[1].trim()
    const firstLine = markdown.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
    return firstLine.replace(/^#+\s*/, "").slice(0, 80)
  }

  async function handle() {
    if (empty) return
    const title = deriveTitle()
    // Most share targets (X, WhatsApp, WeChat via share sheet) truncate
    // anyway, but capping here keeps the system sheet snappy. The full
    // article is one Copy click away if the user wants everything.
    const excerpt = markdown.replace(/^#+.*$/gm, "").trim().slice(0, 600)
    const text = `${excerpt}${markdown.length > 600 ? "…" : ""}`
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text })
        setDone("shared")
      } catch {
        // User dismissed the sheet — not an error worth surfacing.
        return
      }
    } else {
      const fallback = `${title}\n\n${text}\n\n— via TideNow`
      await navigator.clipboard.writeText(fallback)
      setDone("copied")
    }
    setTimeout(() => setDone(null), 1500)
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={empty}
      title={locale === "zh" ? "分享文章" : "Share article"}
      className={`px-3 py-1 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        done
          ? "border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20"
      }`}
    >
      {done === "shared"
        ? locale === "zh" ? "✓ 已分享" : "✓ Shared"
        : done === "copied"
          ? locale === "zh" ? "✓ 已复制" : "✓ Copied"
          : locale === "zh" ? "🔗 分享" : "🔗 Share"}
    </button>
  )
}

// Sits next to the Save buttons. The bottom-left ExportButtons row already
// covers HTML / .md / markdown, but users were missing it; pairing a copy
// affordance with the save group makes "copy → paste elsewhere" feel as
// first-class as "save → keep here".
function CopyMarkdownButton({ markdown, locale }: { markdown: string; locale: "en" | "zh" }) {
  const [copied, setCopied] = useState(false)
  const empty = !markdown.trim()
  return (
    <button
      type="button"
      onClick={async () => {
        if (empty) return
        await navigator.clipboard.writeText(markdown)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      disabled={empty}
      className={`px-3 py-1 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        copied
          ? "border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20"
      }`}
    >
      {copied
        ? locale === "zh" ? "✓ 已复制" : "✓ Copied"
        : locale === "zh" ? "📋 复制" : "📋 Copy"}
    </button>
  )
}
