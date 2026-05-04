import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "bilibili",
  icon: "📺",
  accentColor: "bg-gradient-to-r from-pink-500 to-rose-400",
  interval: 10 * 60 * 1000,
  defaultCount: 10,
  expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://s.search.bilibili.com/main/hotword", {
    headers: { Referer: "https://www.bilibili.com/" },
  })
  const data = await res.json()
  return (data.list as { hot_id: number; keyword: string; show_name: string; heat_layer: string }[]).map((item, i) => ({
    id: String(item.hot_id),
    title: item.show_name || item.keyword,
    url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(item.keyword)}`,
    extra: item.heat_layer ? `热度 ${item.heat_layer}` : undefined,
  }))
}
