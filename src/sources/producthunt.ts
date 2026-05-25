import { myFetch } from "@/lib/fetch"
import { extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "producthunt",
  icon: "🐱",
  accentColor: "bg-gradient-to-r from-rose-500 to-pink-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 20,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.producthunt.com/feed?category=undefined", {
    headers: {
      Accept: "application/atom+xml, application/xml, text/xml",
      Referer: "https://www.producthunt.com/",
    },
  })
  const xml = await res.text()
  const items: NewsItem[] = []

  // Atom format uses <entry> not <item>
  const entries = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const title = block.match(/<title>(.*?)<\/title>/)?.[1]?.trim() ?? ""
    const url = block.match(/<link[^>]+href="([^"]+)"/)?.[1]?.trim() ?? ""
    const summary = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]
      ?.replace(/<[^>]+>/g, "").trim().slice(0, 80) ?? ""
    if (title && url) {
      items.push({
        id: `ph-${i}`,
        title,
        url,
        extra: summary || undefined,
        image: extractImageFromRss(block),
      })
    }
    i++
  }
  return items
}
