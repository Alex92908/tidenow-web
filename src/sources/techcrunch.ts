import { myFetch } from "@/lib/fetch"
import { decodeXmlEntities, extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "techcrunch",
  icon: "🚀",
  accentColor: "bg-gradient-to-r from-green-600 to-emerald-500",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "tech",
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://techcrunch.com/feed/", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  if (!res.ok) return []
  const xml = await res.text()
  const items: NewsItem[] = []
  let i = 0
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1]
    const title = decodeXmlEntities(
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    )
    const link =
      block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    if (title && link) {
      items.push({
        id: `techcrunch-${i}`,
        title,
        url: link,
        image: extractImageFromRss(block),
      })
    }
    i++
    if (i >= 25) break
  }
  return items
}
