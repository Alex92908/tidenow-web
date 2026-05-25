import { myFetch } from "@/lib/fetch"
import { extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "awwwards",
  icon: "🏆",
  accentColor: "bg-gradient-to-r from-rose-500 to-pink-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "tech",
}

export async function fetch(): Promise<NewsItem[]> {
  // Awwwards killed the sites_of_the_day RSS; their blog feed still works
  // and reliably surfaces "Sites of the Day" / "Sites of the Month" posts.
  const res = await myFetch("https://www.awwwards.com/blog/feed/", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]
    const title = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1]?.trim()
      ?? block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    if (title && link) {
      items.push({ id: `awwwards-${items.length}`, title, url: link })
      if (items.length >= 25) break
    }
  }
  return items
}
