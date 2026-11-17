import { myFetch } from "@/lib/fetch"
import { decodeXmlEntities, extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "theverge",
  icon: "📱",
  accentColor: "bg-gradient-to-r from-violet-600 to-purple-500",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "tech",
}

// The Verge's feed is Atom, not RSS 2.0: entries live in <entry> blocks,
// titles are CDATA, and the link is <link rel="alternate" href="...">.
function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "")
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.theverge.com/rss/index.xml", {
    headers: { Accept: "application/atom+xml, application/rss+xml, text/xml" },
  })
  if (!res.ok) return []
  const xml = await res.text()
  const items: NewsItem[] = []
  let i = 0
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1]
    const title = decodeXmlEntities(
      stripCdata(
        block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
      )
    )
    const link =
      block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ??
      block.match(/<link[^>]*href="([^"]+)"/)?.[1] ??
      ""
    if (title && link) {
      items.push({
        id: `theverge-${i}`,
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
