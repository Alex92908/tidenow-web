"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Props {
  value: string
  onChange: (v: string) => void
  loading: boolean
  locale: "en" | "zh"
}

// Center column: split-pane editor + live preview. We deliberately keep it
// a plain <textarea> (not contenteditable) so the user's source is exact
// markdown — what they copy is what they pasted, no smart-quotes or
// hidden formatting baked in by a rich editor.
export function DraftEditor({ value, onChange, loading, locale }: Props) {
  const [mode, setMode] = useState<"split" | "edit" | "preview">("split")
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length
  const charCount = value.length

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mode toggle */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex rounded-md border border-gray-200 dark:border-white/10 p-0.5 text-[11px]">
          {(["edit", "split", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === m
                  ? "bg-sky-500 text-white"
                  : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
              }`}
            >
              {locale === "zh"
                ? { edit: "编辑", split: "对照", preview: "预览" }[m]
                : { edit: "Edit", split: "Split", preview: "Preview" }[m]}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400 dark:text-zinc-600 tabular-nums">
          {locale === "zh"
            ? `${charCount} 字 · ${wordCount} 词`
            : `${wordCount} words · ${charCount} chars`}
        </div>
      </div>

      {/* Pane(s) */}
      <div
        className={`flex-1 min-h-0 grid gap-2 ${
          mode === "split" ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {mode !== "preview" && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              loading
                ? locale === "zh"
                  ? "AI 正在生成…"
                  : "AI is generating…"
                : locale === "zh"
                  ? "在左侧选 1-5 条热点 → 选风格 → 点击生成。或直接在这里手写。"
                  : "Pick 1–5 trends on the left → choose a style → click Generate. Or just start writing."
            }
            spellCheck={false}
            disabled={loading}
            className="w-full h-full resize-none rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-3 text-sm leading-relaxed font-mono text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:opacity-60"
          />
        )}
        {mode !== "edit" && (
          <div className="w-full h-full overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-4 text-sm">
            {value.trim() ? (
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-xs text-gray-400 dark:text-zinc-600 italic">
                {locale === "zh" ? "预览将出现在这里。" : "Preview will appear here."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
