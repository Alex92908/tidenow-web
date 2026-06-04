"use client"

import { useRef } from "react"
import type { Draft } from "@/lib/compose-storage"
import { exportDrafts, importDrafts } from "@/lib/compose-storage"

interface Props {
  drafts: Draft[]
  currentId: string | null
  onPick: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onImported: (drafts: Draft[]) => void
  locale: "en" | "zh"
}

// Right column. Each row shows the first heading line + a relative time.
// "+ New" creates a fresh blank draft. Import / export survives the
// browser cache being nuked or the user moving devices.
export function DraftList({
  drafts,
  currentId,
  onPick,
  onDelete,
  onNew,
  onImported,
  locale,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const blob = new Blob([exportDrafts()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tidenow-drafts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text()
      const next = importDrafts(text, "merge")
      onImported(next)
    } catch (e) {
      alert((locale === "zh" ? "导入失败：" : "Import failed: ") + (e as Error).message)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider">
          {locale === "zh" ? "草稿箱" : "Drafts"}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onNew}
            title={locale === "zh" ? "新草稿" : "New draft"}
            className="px-2 py-0.5 text-[11px] rounded-md bg-sky-500 hover:bg-sky-600 text-white transition-colors"
          >
            + {locale === "zh" ? "新建" : "New"}
          </button>
        </div>
      </div>

      <ol className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/40 divide-y divide-gray-100 dark:divide-white/[0.04]">
        {drafts.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-gray-400 dark:text-zinc-600">
            {locale === "zh" ? "暂无草稿" : "No drafts yet"}
          </li>
        ) : (
          drafts.map((d) => {
            const active = d.id === currentId
            return (
              <li
                key={d.id}
                className={`group flex items-start gap-2 px-3 py-2 transition-colors ${
                  active
                    ? "bg-sky-50 dark:bg-sky-500/10"
                    : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onPick(d.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p
                    className={`text-xs leading-snug line-clamp-2 ${
                      active
                        ? "text-sky-700 dark:text-sky-300 font-medium"
                        : "text-gray-700 dark:text-zinc-300"
                    }`}
                  >
                    {d.preview || (locale === "zh" ? "(空草稿)" : "(empty)")}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-0.5">
                    {relativeTime(d.updatedAt, locale)}
                    {d.materials.length > 0 && (
                      <>
                        {" · "}
                        {d.materials.length} {locale === "zh" ? "条素材" : "items"}
                      </>
                    )}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        locale === "zh"
                          ? "删除这条草稿？"
                          : "Delete this draft?"
                      )
                    )
                      onDelete(d.id)
                  }}
                  className="text-gray-300 dark:text-zinc-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={locale === "zh" ? "删除" : "Delete"}
                >
                  ✕
                </button>
              </li>
            )
          })
        )}
      </ol>

      {/* Import / export — last-resort sync between devices */}
      <div className="mt-2 flex gap-1 text-[11px] shrink-0">
        <button
          type="button"
          onClick={handleExport}
          className="flex-1 px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
        >
          ⤓ {locale === "zh" ? "导出" : "Export"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
        >
          ⤒ {locale === "zh" ? "导入" : "Import"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImportFile(f)
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}

function relativeTime(ts: number, locale: "en" | "zh"): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (locale === "zh") {
    if (d > 0) return `${d} 天前`
    if (h > 0) return `${h} 小时前`
    if (m > 0) return `${m} 分钟前`
    return "刚刚"
  }
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return "just now"
}
