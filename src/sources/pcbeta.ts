import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "pcbeta", icon: "🪟",
  accentColor: "bg-gradient-to-r from-blue-400 to-sky-300",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://bbs.pcbeta.com/forum.php?mod=rss&fid=563&auth=0",
    { headers: { Accept: "application/rss+xml, application/xml, text/xml" } }
  )
  const xml = await res.text()
  const $ = cheerio.load(xml, { xmlMode: true })
  const items: NewsItem[] = []
  $("item").each((i, el) => {
    const title = $(el).find("title").text().trim()
    const link = $(el).find("link").text().trim()
    if (title && link) {
      items.push({ id: `pcbeta-${i}`, title, url: link })
    }
  })
  return items
}
