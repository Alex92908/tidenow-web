import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "anthropic",
  icon: "🧠",
  accentColor: "bg-gradient-to-r from-orange-500 to-amber-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://news.google.com/rss/search?q=site:anthropic.com&hl=en-US&gl=US&ceid=US:en",
    { headers: { Accept: "application/rss+xml, text/xml" } }
  )
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    const title = rawTitle.replace(/\s*-\s*Anthropic\s*$/i, "").trim()
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    if (title && link) {
      items.push({ id: `anthropic-${i}`, title, url: link })
    }
    i++
    if (i >= 25) break
  }
  return items
}
