import { myFetch } from "@/lib/fetch"
import { extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "bbcsport",
  icon: "⚽",
  accentColor: "bg-gradient-to-r from-red-600 to-rose-500",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "global",
}

// BBC Sport top headlines — chosen over ESPN because the latter blocks
// non-browser clients from /espn/rss/news.
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://feeds.bbci.co.uk/sport/rss.xml", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]
    const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim()
      ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    const desc = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
      ?.replace(/<[^>]+>/g, "").trim().slice(0, 80)
      ?? block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?.replace(/<[^>]+>/g, "").trim().slice(0, 80)
    if (title && link) {
      items.push({
        id: `bbcsport-${items.length}`,
        title,
        url: link,
        extra: desc || undefined,
        image: extractImageFromRss(block),
      })
      if (items.length >= 25) break
    }
  }
  return items
}
