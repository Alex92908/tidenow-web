import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "toutiao", icon: "📰",
  accentColor: "bg-gradient-to-r from-red-500 to-orange-400",
  interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc", {
    headers: { Referer: "https://www.toutiao.com/" },
  })
  const data = await res.json()
  return (data.data as {
    ClusterIdStr: string
    Title: string
    HotValue: string
    Image?: { url?: string }
  }[]).map((item) => ({
    id: `toutiao-${item.ClusterIdStr}`,
    title: item.Title,
    url: `https://www.toutiao.com/trending/${item.ClusterIdStr}/`,
    extra: item.HotValue ? `🔥 ${Number(item.HotValue).toLocaleString()}` : undefined,
    image: item.Image?.url,
  }))
}
