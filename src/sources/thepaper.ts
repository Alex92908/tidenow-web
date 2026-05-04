import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "thepaper", icon: "📄",
  accentColor: "bg-gradient-to-r from-zinc-500 to-slate-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://cache.thepaper.cn/contentapi/wwwIndex/rightSidebar", {
    headers: { Referer: "https://www.thepaper.cn/" },
  })
  const data = await res.json()
  const hotNews = data?.data?.hotNews ?? []
  return hotNews.map((item: { contId: string; name: string }) => ({
    id: `thepaper-${item.contId}`,
    title: item.name,
    url: `https://www.thepaper.cn/newsDetail_forward_${item.contId}`,
  }))
}
