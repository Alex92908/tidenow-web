import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "zhihu",
  icon: "🔵",
  accentColor: "bg-gradient-to-r from-blue-500 to-indigo-500",
  interval: 10 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://www.zhihu.com/api/v4/creators/rank/hot?domain=0&limit=30&offset=0",
    { headers: { Referer: "https://www.zhihu.com/" } }
  )
  const data = await res.json()
  return (data.data as { question: { id: string; title: string; url: string }; detail_text?: string }[]).map((item) => ({
    id: item.question.id,
    title: item.question.title,
    url: item.question.url,
    extra: item.detail_text ?? undefined,
  }))
}
