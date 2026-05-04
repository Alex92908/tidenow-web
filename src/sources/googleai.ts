import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "googleai",
  icon: "✨",
  accentColor: "bg-gradient-to-r from-blue-500 to-indigo-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 20,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://blog.google/technology/ai/rss/", {
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
    if (title && link) {
      items.push({ id: `googleai-${i}`, title, url: link })
    }
    i++
    if (i >= 20) break
  }
  return items
}
