import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "zaobao", icon: "🗞️",
  accentColor: "bg-gradient-to-r from-red-700 to-red-500",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

const BASE = "https://www.zaochenbao.com"

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(`${BASE}/realtime/`, {
    headers: { Referer: BASE },
  })
  // Site uses GBK encoding — decode with TextDecoder
  const buf = await res.arrayBuffer()
  const html = new TextDecoder("gbk").decode(buf)
  const $ = cheerio.load(html)
  const items: NewsItem[] = []
  $("div.list-block>a.item").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    const title = $(el).find(".eps").text().trim()
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
