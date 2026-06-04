"use client"

import { useState } from "react"

interface Props {
  markdown: string
  locale: "en" | "zh"
}

// Phase-1 publishing flow: copy or download. No third-party platform
// integration here — the user takes the markdown wherever they want.
// WeChat / Toutiao integration is deliberately out of scope (see
// docs/2026-05-31-session-notes.md for the rationale).
export function ExportButtons({ markdown, locale }: Props) {
  const [copied, setCopied] = useState<"md" | "html" | null>(null)
  const empty = !markdown.trim()

  async function copyMd() {
    await navigator.clipboard.writeText(markdown)
    setCopied("md")
    setTimeout(() => setCopied(null), 1500)
  }

  async function copyHtml() {
    // Convert markdown to a copy-friendly HTML by leveraging the same
    // renderer the preview pane uses. Simpler: pull innerHTML off a hidden
    // node. To avoid the round-trip, we ship a minimal converter inline —
    // this is "good enough for paste into WeChat / Notion / Medium".
    const html = mdToHtml(markdown)
    await navigator.clipboard.writeText(html)
    setCopied("html")
    setTimeout(() => setCopied(null), 1500)
  }

  function downloadMd() {
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tidenow-${stamp}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={copyMd}
        disabled={empty}
        className="px-2.5 py-1 text-[11px] rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {copied === "md"
          ? locale === "zh" ? "✓ 已复制" : "✓ Copied"
          : locale === "zh" ? "复制 Markdown" : "Copy Markdown"}
      </button>
      <button
        type="button"
        onClick={copyHtml}
        disabled={empty}
        className="px-2.5 py-1 text-[11px] rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={locale === "zh" ? "粘贴到公众号 / Notion / Medium" : "Paste into WeChat / Notion / Medium"}
      >
        {copied === "html"
          ? locale === "zh" ? "✓ 已复制" : "✓ Copied"
          : locale === "zh" ? "复制 HTML" : "Copy HTML"}
      </button>
      <button
        type="button"
        onClick={downloadMd}
        disabled={empty}
        className="px-2.5 py-1 text-[11px] rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ⤓ .md
      </button>
    </div>
  )
}

// Tiny markdown→HTML for the "Copy HTML" action. Intentionally minimal:
// headings, paragraphs, bold/italic, links, inline code, bullets,
// numbered lists, horizontal rules. Anything fancier (tables, fenced code
// highlighting) is rarely needed for public-account paste targets.
function mdToHtml(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const lines = md.split("\n")
  const out: string[] = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false }
    if (inOl) { out.push("</ol>"); inOl = false }
  }

  function inline(s: string): string {
    let r = escape(s)
    r = r.replace(/`([^`]+)`/g, "<code>$1</code>")
    r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    r = r.replace(/\*([^*]+)\*/g, "<em>$1</em>")
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    return r
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === "") { closeLists(); continue }
    if (line === "---" || line === "***") { closeLists(); out.push("<hr/>"); continue }

    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      closeLists()
      const level = h[1].length
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      continue
    }
    const ul = line.match(/^[-*]\s+(.*)$/)
    if (ul) {
      if (!inUl) { closeLists(); out.push("<ul>"); inUl = true }
      out.push(`<li>${inline(ul[1])}</li>`)
      continue
    }
    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      if (!inOl) { closeLists(); out.push("<ol>"); inOl = true }
      out.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    closeLists()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeLists()
  return out.join("\n")
}
