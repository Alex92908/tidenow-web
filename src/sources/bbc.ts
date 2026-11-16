import { myFetch } from "@/lib/fetch"
import { decodeXmlEntities, extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "bbc",
  icon: "🇬🇧",
  accentColor: "bg-gradient-to-r from-red-600 to-red-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://feeds.bbci.co.uk/news/world/rss.xml", {
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
    // Decode entities before stripping tags (see theguardian.ts — a
    // double-encoded description would otherwise leak "&lt;p&gt;").
    const rawDesc =
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
      ?? block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
    const desc = rawDesc
      ? decodeXmlEntities(rawDesc).replace(/<[^>]+>/g, "").trim().slice(0, 80)
      : undefined
    if (title && link) {
      items.push({ id: `bbc-${i}`, title, url: link, extra: desc || undefined, image: extractImageFromRss(block) })
    }
    i++
  }
  return items
}
