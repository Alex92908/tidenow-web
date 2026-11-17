import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "weread",
  icon: "📚",
  accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 20,
  column: "china",
}

// 微信读书小说榜 — the rank page embeds its state as
// window.__INITIAL_STATE__ = {...}; the "general_novel_rising" category
// (小说榜) holds 20 books in lectureBooks[].bookInfo:
//   { bookId, title, author, cover, deepLink }
// https://weread.qq.com/web/category/ranklist
type BookInfo = {
  bookId?: string
  title?: string
  author?: string
  cover?: string
  deepLink?: string
}

// Extract a balanced {...} JSON object starting at `marker`, honouring
// string literals so braces inside quoted text don't break the scan.
function extractStateJson(html: string, marker: string): string | null {
  const at = html.indexOf(marker)
  if (at < 0) return null
  const start = html.indexOf("{", at)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
    } else {
      if (c === '"') inStr = true
      else if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) return html.slice(start, i + 1)
      }
    }
  }
  return null
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://weread.qq.com/web/category/ranklist",
    { headers: { Accept: "text/html" } }
  )
  if (!res.ok) return []
  const html = await res.text()
  const raw = extractStateJson(html, "window.__INITIAL_STATE__=")
  if (!raw) return []
  let state: unknown
  try {
    state = JSON.parse(raw)
  } catch {
    return []
  }
  const categories = (
    state as {
      homeStoreModule?: { topCategories?: { CategoryId?: string; lectureBooks?: { bookInfo?: BookInfo }[] }[] }
    }
  ).homeStoreModule?.topCategories
  const novel = categories?.find((c) => c.CategoryId === "general_novel_rising")
  const books = novel?.lectureBooks ?? []
  return books.slice(0, 20).map((entry, i) => {
    const b = entry.bookInfo ?? {}
    return {
      id: `weread|${b.bookId ?? i}`,
      title: b.author ? `${b.title ?? ""} - ${b.author}` : (b.title ?? ""),
      url:
        b.deepLink ?? "https://weread.qq.com/web/category/ranklist",
      extra: `#${i + 1}`,
      image: b.cover,
      imageLarge: b.cover,
    }
  })
}
