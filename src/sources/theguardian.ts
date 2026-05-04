import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "theguardian",
  icon: "🔵",
  accentColor: "bg-gradient-to-r from-blue-700 to-cyan-500",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.theguardian.com/world/rss", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
      ?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
      ?? block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ?? ""
    const desc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim().slice(0, 80)
    if (title && link) {
      items.push({ id: `guardian-${i}`, title, url: link, extra: desc || undefined })
    }
    i++
  }
  return items
}
