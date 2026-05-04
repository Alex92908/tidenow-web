import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "mktnews", icon: "📊",
  accentColor: "bg-gradient-to-r from-cyan-500 to-blue-400",
  interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.mktnews.net/api/flash?type=0&limit=50",
    { headers: { Referer: "https://mktnews.net/" } }
  )
  const data = await res.json()
  return (data?.data ?? [])
    .map((item: { id: string; data: { title?: string; content?: string }; important?: number }) => {
      const raw = item.data.title || item.data.content || ""
      const [, bracketTitle] = raw.match(/^【([^】]*)】/) ?? []
      const title = bracketTitle ?? raw.substring(0, 60)
      return {
        id: `mktnews-${item.id}`,
        title,
        url: `https://mktnews.net/flashDetail.html?id=${item.id}`,
        extra: item.important === 1 ? "⭐ 重要" : undefined,
      }
    })
}
