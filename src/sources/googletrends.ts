import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "googletrends",
  icon: "📈",
  accentColor: "bg-gradient-to-r from-blue-500 to-green-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://trends.google.com/trending/rss?geo=US", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    const traffic = block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1]?.trim() ?? ""
    if (title) {
      items.push({
        id: `gt-${i}`,
        title,
        url: link || `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}`,
        extra: traffic ? `${traffic} searches` : undefined,
      })
    }
    i++
  }
  return items
}
