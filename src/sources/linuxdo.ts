import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "linuxdo", icon: "🐧",
  accentColor: "bg-gradient-to-r from-yellow-500 to-orange-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://linux.do/latest.rss", {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  })
  const xml = await res.text()
  const $ = cheerio.load(xml, { xmlMode: true })
  const items: NewsItem[] = []
  $("item").each((i, el) => {
    const title = $(el).find("title").text().trim()
    const link = $(el).find("link").text().trim()
    // Discourse RSS embeds the post body as HTML inside <description>;
    // pull the first <img src=…> as a thumbnail when present.
    const desc = $(el).find("description").text()
    const img = desc.match(/<img[^>]+src=["']([^"']+)["']/)?.[1]
    if (title && link) {
      items.push({ id: `linuxdo-${i}`, title, url: link, image: img })
    }
  })
  return items
}
