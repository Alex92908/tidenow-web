import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "douban", icon: "🎬",
  accentColor: "bg-gradient-to-r from-green-600 to-lime-400",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 20,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie", {
    headers: {
      Referer: "https://m.douban.com/",
      Accept: "application/json",
    },
  })
  const data = await res.json()
  return (data.items ?? []).map((item: {
    id: string
    title: string
    rating?: { value: number }
    card_subtitle?: string
    pic?: { normal?: string; large?: string }
    cover?: { url?: string }
  }) => ({
    id: `douban-${item.id}`,
    title: item.title,
    url: `https://movie.douban.com/subject/${item.id}`,
    extra: item.rating?.value ? `⭐ ${item.rating.value} · ${item.card_subtitle ?? ""}` : item.card_subtitle,
    image: item.pic?.normal || item.pic?.large || item.cover?.url,
    imageLarge: item.pic?.large || item.pic?.normal || item.cover?.url,
  }))
}
