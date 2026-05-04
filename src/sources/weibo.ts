import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "weibo",
  icon: "🌊",
  accentColor: "bg-gradient-to-r from-orange-400 to-red-500",
  interval: 5 * 60 * 1000,
  defaultCount: 10,
  expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://weibo.com/ajax/side/hotSearch", {
    headers: {
      Referer: "https://weibo.com/",
      Accept: "application/json, text/plain, */*",
    },
  })
  const data = await res.json()
  const realtime: { word: string; num: number; label_name?: string; note?: string }[] =
    data?.data?.realtime ?? []

  return realtime
    .filter((item) => item.word)
    .map((item, i) => ({
      id: `weibo-${i}`,
      title: item.word,
      url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word)}`,
      extra: item.num ? `🔥 ${item.num.toLocaleString()}` : item.label_name ?? undefined,
    }))
}
