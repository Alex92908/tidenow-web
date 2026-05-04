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
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: BASE,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []

  // try primary selector, fall back to generic thread links
  $(".bmw table tr").each((i, el) => {
    const a = $(el).find(".common .xst, .common a").first()
    const title = a.text().trim()
    const href = a.attr("href") ?? ""
    if (title && href) {
      items.push({
        id: `chongbuluo-${i}`,
        title,
        url: href.startsWith("http") ? href : BASE + href,
      })
    }
  })

  if (items.length === 0) {
    $("a[href*='thread']").each((i, el) => {
      const title = $(el).text().trim()
      const href = $(el).attr("href") ?? ""
      if (title.length > 5 && href) {
        items.push({
          id: `chongbuluo-${i}`,
          title,
          url: href.startsWith("http") ? href : BASE + href,
        })
      }
    })
  }

  return items.slice(0, 25)
}
