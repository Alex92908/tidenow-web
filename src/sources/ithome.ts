import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "ithome",
  icon: "🖥️",
  accentColor: "bg-gradient-to-r from-red-400 to-orange-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.ithome.com/rss/", {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of itemMatches) {
    const block = match[1]
    const title = block.match(/<title>(.*?)<\/title>/)?.[1]?.trim() ?? ""
    const url = block.match(/<link>(https?:\/\/[^<]+)<\/link>/)?.[1]?.trim() ?? ""
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim()
    if (title && url) {
      const t = pubDate ? new Date(pubDate).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : undefined
      items.push({ id: `ithome-${i}`, title, url, extra: t })
    }
    i++
  }
  return items
}
