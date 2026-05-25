import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "baidu",
  icon: "🔍",
  accentColor: "bg-gradient-to-r from-blue-600 to-blue-400",
  interval: 5 * 60 * 1000,
  defaultCount: 10,
  expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://top.baidu.com/board?tab=realtime", {
    headers: {
      Referer: "https://www.baidu.com/",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  })
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []

  $(".category-wrap_iQLoo").each((i, el) => {
    const a = $(el).find("a.img-wrapper_29V76, a[href*='baidu.com/s']").first()
    const href = a.attr("href") ?? ""
    const wordMatch = href.match(/[?&]wd=([^&]+)/)
    if (!wordMatch) return
    const word = decodeURIComponent(wordMatch[1].replace(/\+/g, " "))
    const hotIndex = $(el).find(".hot-index_1Bl1a").text().trim()
    // Baidu puts the topic image inside an <img> within the wrapper
    const img = $(el).find("img").first().attr("src") ?? undefined
    if (word) {
      items.push({
        id: `baidu-${i}`,
        title: word,
        url: `https://www.baidu.com/s?wd=${encodeURIComponent(word)}`,
        extra: hotIndex ? `🔥 ${Number(hotIndex).toLocaleString()}` : undefined,
        image: img,
      })
    }
  })

  // Fallback: the SSR HTML embeds a JSON blob with hot list — if cheerio
  // selectors above missed images (markup changes), pull `img` URLs from
  // the JSON-in-HTML.
  if (items.some((it) => !it.image)) {
    const imgMatches = [...html.matchAll(/"img":"([^"]+)"/g)]
    for (let i = 0; i < items.length && i < imgMatches.length; i++) {
      if (!items[i].image) items[i].image = imgMatches[i][1].replace(/\\u002F/g, "/")
    }
  }

  return items
}
