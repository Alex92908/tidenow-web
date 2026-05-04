import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "reddit",
  icon: "🤖",
  accentColor: "bg-gradient-to-r from-orange-400 to-red-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.reddit.com/r/popular.json?limit=30", {
    headers: { Accept: "application/json" },
  })
  const data = await res.json()
  return data.data.children.map((c: { data: { id: string; title: string; permalink: string; subreddit: string; score: number } }) => ({
    id: c.data.id,
    title: c.data.title,
    url: `https://www.reddit.com${c.data.permalink}`,
    extra: `r/${c.data.subreddit} · ▲${c.data.score.toLocaleString()}`,
  }))
}
