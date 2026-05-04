import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "tldrai",
  icon: "⚡",
  accentColor: "bg-gradient-to-r from-violet-500 to-purple-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 20,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://tldr.tech/api/rss/ai", {
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
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? ""
    const dateStr = pubDate ? new Date(pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""
    if (title && link) {
      items.push({ id: `tldrai-${i}`, title, url: link, extra: dateStr || undefined })
    }
    i++
    if (i >= 20) break
  }
  return items
}
