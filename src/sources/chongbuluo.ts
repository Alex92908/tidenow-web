import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "chongbuluo", icon: "🐛",
  accentColor: "bg-gradient-to-r from-lime-500 to-green-400",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

const BASE = "https://www.chongbuluo.com/"

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(`${BASE}forum.php?mod=guide&view=hot`, {
    headers: { Referer: BASE },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []
  $(".bmw table tr").each((i, el) => {
    const title = $(el).find(".common .xst").text().trim()
    const href = $(el).find(".common a").attr("href") ?? ""
    if (title && href) {
      items.push({
        id: `chongbuluo-${i}`,
        title,
        url: href.startsWith("http") ? href : BASE + href,
      })
    }
  })
  return items
}
