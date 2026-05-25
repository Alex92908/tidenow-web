import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "behance",
  icon: "🎨",
  accentColor: "bg-gradient-to-r from-blue-600 to-indigo-500",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "tech",
}

// Behance public project feed (chosen over the deprecated Dribbble RSS).
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.behance.net/feeds/projects", {
    headers: { Accept: "application/rss+xml, application/atom+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  // Atom feed uses <entry> ... <title>...</title> <link href="..." />
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = m[1]
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? ""
    const link = block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? ""
    const author = block.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim() ?? ""
    if (title && link) {
      items.push({
        id: `behance-${items.length}`,
        title,
        url: link,
        extra: author || undefined,
      })
      if (items.length >= 25) break
    }
  }
  // Fallback: try RSS-style <item> if no <entry> matched
  if (items.length === 0) {
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1]
      const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim()
        ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
      if (title && link) {
        items.push({ id: `behance-${items.length}`, title, url: link })
        if (items.length >= 25) break
      }
    }
  }
  return items
}
