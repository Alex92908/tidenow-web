import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "huggingface",
  icon: "🤗",
  accentColor: "bg-gradient-to-r from-yellow-400 to-orange-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://huggingface.co/api/papers?limit=30",
    { headers: { Accept: "application/json" } }
  )
  const data = await res.json() as Array<{
    id: string
    title: string
    upvotes: number
  }>
  return data
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
    .slice(0, 25)
    .map((item) => ({
      id: item.id,
      title: item.title,
      url: `https://huggingface.co/papers/${item.id}`,
      extra: `▲ ${item.upvotes ?? 0}`,
    }))
}
