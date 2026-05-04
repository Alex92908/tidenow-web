import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "36kr",
  icon: "💡",
  accentColor: "bg-gradient-to-r from-blue-400 to-cyan-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://36kr.com/feed", {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of itemMatches) {
    const block = match[1]
    const title = block.match(/<title>(.*?)<\/title>/)?.[1]?.trim() ?? ""
    const linkMatch = block.match(/<!\[CDATA\[(https?:\/\/[^\]]+)\]\]>/)
      ?? block.match(/<link>(https?:\/\/[^<]+)<\/link>/)
    const url = linkMatch?.[1]?.trim() ?? ""
    if (title && url) {
      items.push({ id: `36kr-${i}`, title, url })
    }
    i++
  }
  return items
}
