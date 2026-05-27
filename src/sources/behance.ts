import { myFetch } from "@/lib/fetch"
import { extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "behance",
  icon: "🎨",
  accentColor: "bg-gradient-to-r from-blue-600 to-indigo-500",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "tech",
}

// Behance's project feed is RSS 2.0 (not Atom) and wraps every text field in
// CDATA — including <link>, which my earlier code wasn't stripping, so URLs
// came out as "<![CDATA[https://...]]>".
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.behance.net/feeds/projects", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  })
  const xml = await res.text()
  const stripCdata = (s: string | undefined) =>
    s?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? ""

  const items: NewsItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]
    const title = stripCdata(block.match(/<title>([\s\S]*?)<\/title>/)?.[1])
    const link = stripCdata(block.match(/<link>([\s\S]*?)<\/link>/)?.[1])
    if (title && link) {
      items.push({
        id: `behance-${items.length}`,
        title,
        url: link,
        image: extractImageFromRss(block),
      })
      if (items.length >= 25) break
    }
  }
  return items
}
