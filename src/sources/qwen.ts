import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "qwen",
  icon: "💜",
  accentColor: "bg-gradient-to-r from-purple-600 to-violet-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const q = encodeURIComponent("通义千问 OR Qwen 阿里 OR 阿里AI 模型")
  const res = await myFetch(
    `https://news.google.com/rss/search?q=${q}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`,
    { headers: { Accept: "application/rss+xml, text/xml" } }
  )
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    if (title && link) {
      items.push({ id: `qwen-${i}`, title, url: link })
    }
    i++
    if (i >= 25) break
  }
  return items
}
