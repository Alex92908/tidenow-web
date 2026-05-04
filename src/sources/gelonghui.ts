import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "gelonghui", icon: "💹",
  accentColor: "bg-gradient-to-r from-amber-500 to-orange-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

const BASE = "https://www.gelonghui.com"

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(`${BASE}/news/`, {
    headers: { Referer: BASE },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []
  $(".article-content").each((_, el) => {
    const a = $(el).find(".detail-right>a")
    const href = a.attr("href") ?? ""
    const title = a.find("h2").text().trim()
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
