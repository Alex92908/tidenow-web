"use client"

import { useState } from "react"

interface Props {
  markdown: string
  outputLocale: "en" | "zh"
  uiLocale: "en" | "zh"
}

// Generates a complete frontmatter + body .md file and downloads it.
// "Publish" on TideNow means: the file ends up in src/data/posts/ via
// a git commit. This button does the first half — produces a ready-to-
// commit file. The user (with repo write access) does the second half.
//
// We deliberately don't open a GitHub PR or POST anywhere — UGC auto-
// publish would invite spam and tank the site's AdSense profile. See
// docs/2026-05-31-session-notes.md for the full reasoning.
export function PublishButton({ markdown, outputLocale, uiLocale }: Props) {
  const [open, setOpen] = useState(false)
  const empty = !markdown.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={empty}
        title={
          uiLocale === "zh"
            ? "导出可提交到仓库的 .md 文件"
            : "Export a commit-ready .md file"
        }
        className="px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        📤 {uiLocale === "zh" ? "导出发布文件" : "Export for publish"}
      </button>
      {open && (
        <PublishModal
          markdown={markdown}
          outputLocale={outputLocale}
          uiLocale={uiLocale}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function PublishModal({
  markdown,
  outputLocale,
  uiLocale,
  onClose,
}: {
  markdown: string
  outputLocale: "en" | "zh"
  uiLocale: "en" | "zh"
  onClose: () => void
}) {
  // Pre-fill from the markdown body so the user only confirms — they're
  // not asked to re-type things they already wrote.
  const derived = deriveDefaults(markdown)
  const [slug, setSlug] = useState(derived.slug)
  const [title, setTitle] = useState(derived.title)
  const [description, setDescription] = useState(derived.description)
  const [author, setAuthor] = useState("Alex")
  const [tags, setTags] = useState("")
  const [cover, setCover] = useState(derived.cover)

  const date = new Date().toISOString().slice(0, 10)

  function buildFile(): string {
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    // YAML-ish: enough for our hand-rolled parser in src/lib/posts.ts.
    // Quote values that contain colons or other YAML metacharacters.
    const fm: string[] = [
      "---",
      `slug: ${slug}`,
      `title: ${quote(title)}`,
      description ? `description: ${quote(description)}` : "",
      `date: ${date}`,
      author ? `author: ${quote(author)}` : "",
      `locale: ${outputLocale}`,
      tagList.length > 0 ? `tags: [${tagList.map((t) => quote(t)).join(", ")}]` : "",
      cover ? `cover: ${cover}` : "",
      "---",
      "",
    ].filter(Boolean)
    // Strip a leading H1 from the body if it matches the title — the
    // detail page already renders the title as <h1>, so leaving it in
    // the body would render twice.
    const cleaned = stripLeadingH1(markdown, title)
    return fm.join("\n") + "\n" + cleaned + "\n"
  }

  function handleDownload() {
    const filename = `${slug || "untitled"}.md`
    const blob = new Blob([buildFile()], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildFile())
  }

  const t = (zh: string, en: string) => (uiLocale === "zh" ? zh : en)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            📤 {t("导出发布文件", "Export for publish")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <Field label={t("slug · URL 段", "slug · URL segment")} hint={t("决定文章 URL,只能小写字母数字和连字符", "Sets the URL. Lowercase alnum + dashes.")}>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className={inputClass}
              placeholder="my-article"
            />
          </Field>

          <Field label={t("title · 标题", "title")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>

          <Field label={t("description · 一句话摘要 (SEO)", "description · one-liner (SEO)")}>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t("author", "author")}>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("date", "date")}>
              <input value={date} readOnly className={`${inputClass} opacity-60`} />
            </Field>
          </div>

          <Field label={t("tags · 逗号分隔(可选)", "tags · comma-separated (optional)")}>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="ai, weekly" />
          </Field>

          <Field label={t("cover · 封面图 URL(可选)", "cover · cover image URL (optional)")}>
            <input value={cover} onChange={(e) => setCover(e.target.value)} className={inputClass} placeholder="https://..." />
          </Field>

          <div className="mt-4 p-3 rounded-md bg-sky-50 dark:bg-sky-500/10 text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed">
            {t(
              "下载后,把文件放到本地仓库的 src/data/posts/ 目录,git push 后 Vercel 会自动部署。文章会出现在 /posts/" + slug,
              "Drop the file into src/data/posts/ in your local clone and git push. Vercel auto-deploys; the post lands at /posts/" + slug
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200"
            >
              {t("复制全文", "Copy text")}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!slug || !title}
              className="px-4 py-1.5 text-xs rounded-md bg-sky-500 hover:bg-sky-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ⤓ {t("下载 .md", "Download .md")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  "w-full rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-400"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 dark:text-zinc-500 mb-1 font-medium">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────

function deriveDefaults(markdown: string): {
  slug: string
  title: string
  description: string
  cover: string
} {
  const h1 = markdown.match(/^#\s+(.+)$/m)
  const title = h1 ? h1[1].trim() : ""

  // First paragraph (skip headings, blank lines, image-only lines).
  const firstPara =
    markdown
      .split("\n\n")
      .map((b) => b.trim())
      .find((b) => b && !b.startsWith("#") && !b.startsWith("![") && !b.startsWith("---")) ?? ""

  // Strip inline markdown so the description reads cleanly. Then break at
  // a sentence end or word boundary rather than mid-word — '... recent d'
  // (literally cut at a space-less char) is what users see otherwise.
  const description = smartTruncate(firstPara.replace(/[*_`]/g, ""), 160)

  // First image's URL → cover suggestion.
  const img = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/)
  const cover = img ? img[1] : ""

  return { slug: slugify(title), title, description, cover }
}

/**
 * Truncate respecting natural breaks:
 *   1. Prefer the last `.`/`。`/`！`/`？`/`!`/`?` that ends a clause within the
 *      target window — gives us a complete sentence.
 *   2. Fall back to the last whitespace before the limit + ellipsis — avoids
 *      severing words like 'recent d…'.
 *   3. Only as a last resort do we hard-slice (e.g. for CJK runs with no
 *      spaces, where char-by-char IS the natural break).
 */
function smartTruncate(s: string, max: number): string {
  const text = s.trim().replace(/\s+/g, " ")
  if (text.length <= max) return text

  // Look back from `max` for a sentence terminator.
  const window = text.slice(0, max + 1)
  const sentenceEnd = window.search(/[.!?。！？][^.!?。！？]*$/)
  if (sentenceEnd > max * 0.5) {
    // The regex matches the start of the *last* sentence's trailing tail;
    // we want the punctuation itself, which sits just before that match.
    return text.slice(0, sentenceEnd + 1).trim()
  }

  // Fall back to last word boundary.
  const space = window.lastIndexOf(" ")
  if (space > max * 0.5) {
    return text.slice(0, space).trim() + "…"
  }

  // No reasonable break — accept a hard cut + ellipsis. Common for CJK
  // text that's one continuous run.
  return text.slice(0, max).trim() + "…"
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // drop punctuation incl. CJK (CJK slugs aren't URL-safe enough)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

function quote(s: string): string {
  // Quote anything containing a colon, hash, leading dash, or yaml-special
  // char so the frontmatter parser doesn't choke.
  if (/[:#\[\]{}"',|>&*!%@`]|^-/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  return s
}

function stripLeadingH1(md: string, title: string): string {
  const lines = md.split("\n")
  const first = lines.findIndex((l) => l.trim().length > 0)
  if (first === -1) return md
  const candidate = lines[first].trim()
  if (candidate.startsWith("# ") && candidate.slice(2).trim() === title.trim()) {
    return lines.slice(first + 1).join("\n").replace(/^\n+/, "")
  }
  return md
}
