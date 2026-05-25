import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "sspai", icon: "✂️",
  accentColor: "bg-gradient-to-r from-red-400 to-rose-300",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const ts = Math.floor(Date.now() / 1000)
  const res = await myFetch(
    `https://sspai.com/api/v1/article/tag/page/get?limit=30&offset=0&created_at=${ts}&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0&released=false`,
    { headers: { Referer: "https://sspai.com/" } }
  )
  const data = await res.json()
  return (data.data ?? []).map((item: { id: number; title: string; banner?: string }) => ({
    id: `sspai-${item.id}`,
    title: item.title,
    url: `https://sspai.com/post/${item.id}`,
    image: item.banner ? `https://cdn.sspai.com/${item.banner}` : undefined,
  }))
}
