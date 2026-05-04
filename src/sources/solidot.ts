import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "solidot", icon: "🔬",
  accentColor: "bg-gradient-to-r from-violet-500 to-purple-400",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

const BASE = "https://www.solidot.org"

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(BASE, { headers: { Referer: BASE } })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []
  $(".block_m").each((_, el) => {
    const a = $(el).find(".bg_htit a").last()
    const href = a.attr("href") ?? ""
    const title = a.text().trim()
    if (title && href) {
      items.push({
        id: href,
        title,
        url: href.startsWith("http") ? href : BASE + href,
      })
    }
  })
  return items
}
