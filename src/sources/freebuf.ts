import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "freebuf", icon: "🔐",
  accentColor: "bg-gradient-to-r from-red-600 to-orange-500",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.freebuf.com", {
    headers: {
      Referer: "https://www.freebuf.com/",
      Accept: "text/html,application/xhtml+xml",
    },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const items: NewsItem[] = []
  $("a[href*='/articles/']").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    const text = $(el).text().trim().replace(/\s+/g, " ")
    const url = href.startsWith("http") ? href : `https://www.freebuf.com${href}`
    if (text.length > 10 && !seen.has(url)) {
      seen.add(url)
      items.push({ id: `freebuf-${items.length}`, title: text.substring(0, 100), url })
    }
  })
  return items.slice(0, 25)
}
