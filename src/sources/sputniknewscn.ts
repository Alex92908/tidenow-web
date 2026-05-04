import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "sputniknewscn", icon: "🌐",
  accentColor: "bg-gradient-to-r from-blue-700 to-indigo-600",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://sputniknews.cn/services/widget/lenta/", {
    headers: { Referer: "https://sputniknews.cn/" },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []
  $(".lenta__item").each((_, el) => {
    const a = $(el).find("a")
    const href = a.attr("href") ?? ""
    const title = a.find(".lenta__item-text").text().trim()
    if (title && href) {
      items.push({
        id: href,
        title,
        url: href.startsWith("http") ? href : `https://sputniknews.cn${href}`,
      })
    }
  })
  return items
}
