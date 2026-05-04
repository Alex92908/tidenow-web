import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "devto",
  icon: "👩‍💻",
  accentColor: "bg-gradient-to-r from-violet-600 to-indigo-500",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://dev.to/api/articles?top=1&per_page=25", {
    headers: { Accept: "application/json" },
  })
  const data = await res.json()
  return (data as Array<{
    id: number
    title: string
    url: string
    user: { name: string }
    positive_reactions_count: number
  }>).map((a) => ({
    id: String(a.id),
    title: a.title,
    url: a.url,
    extra: `${a.user.name} · ❤️${a.positive_reactions_count}`,
  }))
}
