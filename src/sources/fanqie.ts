import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "fanqie",
  icon: "🍅",
  accentColor: "bg-gradient-to-r from-red-500 to-orange-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 10,
  column: "china",
}

// 番茄小说热榜 — two-step fetch, because the rank page obfuscates titles:
//   1. /rank embeds __INITIAL_STATE__ with book_list: bookId + thumbUri are
//      clean, but bookName/author are font-obfuscated (private-use chars).
//   2. Each book's own page (/page/{bookId}) is NOT obfuscated — its state
//      carries the clean bookName + authorName.
// So we take the 10 bookIds from the rank page and resolve names in parallel
// from the book pages. The official rank API (/api/rank/category/list) was
// tested with every parameter combination and always returns an empty list,
// so it is not used. https://fanqienovel.com/rank
type RankBook = {
  bookId?: string
  thumbUri?: string
  currentPos?: number
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

// Pull a quoted string value out of the page state and unescape it.
// Returns undefined when the key is absent.
function stateString(html: string, key: string): string | undefined {
  const m = new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`).exec(html)
  if (!m) return undefined
  try {
    return JSON.parse(`"${m[1]}"`) as string
  } catch {
    return m[1]
  }
}

async function resolveBook(
  book: RankBook
): Promise<{ name: string; author: string } | null> {
  if (!book.bookId) return null
  try {
    const res = await myFetch(`https://fanqienovel.com/page/${book.bookId}`, {
      headers: { Accept: "text/html" },
    })
    if (!res.ok) return null
    const html = await res.text()
    const name = stateString(html, "bookName")
    const author =
      stateString(html, "authorName") ?? stateString(html, "author")
    if (!name) return null
    return { name, author: author ?? "" }
  } catch {
    return null
  }
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://fanqienovel.com/rank", {
    headers: { Accept: "text/html" },
  })
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
  const books = (
    state as { rank?: { book_list?: RankBook[] } }
  ).rank?.book_list
  if (!Array.isArray(books) || books.length === 0) return []
  const resolved = await Promise.all(books.slice(0, 10).map(resolveBook))
  return books.slice(0, 10).flatMap((book, i) => {
    const r = resolved[i]
    if (!r || !book.bookId) return []
    const cover = book.thumbUri
    return [
      {
        id: `fanqie|${book.bookId}`,
        title: r.author ? `${r.name} - ${r.author}` : r.name,
        url: `https://fanqienovel.com/page/${book.bookId}`,
        extra: `#${book.currentPos ?? i + 1}`,
        image: cover,
        imageLarge: cover,
      },
    ]
  })
}
