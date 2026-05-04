import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "hupu", icon: "🏀",
  accentColor: "bg-gradient-to-r from-orange-500 to-amber-400",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://bbs.hupu.com/topic-daily-hot", {
    headers: { Referer: "https://bbs.hupu.com/" },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []

  $(".bbs-sl-web-post-body").each((i, el) => {
    const a = $(el).find("a.post-title, a[href*='/']").first()
    const title = a.text().trim()
    const href = a.attr("href") ?? ""
    if (title) {
      items.push({
        id: `hupu-${i}`,
        title,
        url: href.startsWith("http") ? href : `https://bbs.hupu.com${href}`,
      })
    }
  })
  return items
}
