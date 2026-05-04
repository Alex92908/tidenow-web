import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "tencent", icon: "🐧",
  accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://i.news.qq.com/web_backend/v2/getTagInfo?tagId=aEWqxLtdgmQ%3D",
    { headers: { Referer: "https://news.qq.com/" } }
  )
  const data = await res.json()
  return (data?.data?.tabs?.[0]?.articleList ?? []).map(
    (item: { id: string; title: string; link_info?: { url?: string }; desc?: string }) => ({
      id: `tencent-${item.id}`,
      title: item.title,
      url: item.link_info?.url ?? `https://news.qq.com/`,
    })
  )
}
