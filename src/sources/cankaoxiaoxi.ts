import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "cankaoxiaoxi", icon: "📰",
  accentColor: "bg-gradient-to-r from-slate-600 to-gray-500",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

const CHANNELS = ["zhongguo", "guandian", "gj"]

export async function fetch(): Promise<NewsItem[]> {
  const results = await Promise.all(
    CHANNELS.map((ch) =>
      myFetch(`https://china.cankaoxiaoxi.com/json/channel/${ch}/list.json`, {
        headers: { Referer: "https://www.cankaoxiaoxi.com/" },
      }).then((r) => r.json())
    )
  )
  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const res of results) {
    for (const entry of res?.list ?? []) {
      const { id, title, url } = entry?.data ?? {}
      if (title && url && !seen.has(id)) {
        seen.add(id)
        items.push({ id: `ckxx-${id}`, title, url })
      }
    }
  }
  return items
}
