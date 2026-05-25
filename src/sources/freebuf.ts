import { myFetch } from "@/lib/fetch"
import { extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "freebuf", icon: "🔐",
  accentColor: "bg-gradient-to-r from-red-600 to-orange-500",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.freebuf.com/feed", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim()
      ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
      ?? block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ?? ""
    const category = block.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/)?.[1]?.trim()
    if (title && link) {
      items.push({ id: `freebuf-${i}`, title, url: link, extra: category || undefined })
    }
    i++
    if (i >= 25) break
  }
  return items
}
