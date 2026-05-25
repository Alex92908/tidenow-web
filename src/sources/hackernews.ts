import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "hackernews",
  icon: "🔶",
  accentColor: "bg-gradient-to-r from-orange-500 to-yellow-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://hacker-news.firebaseio.com/v0/topstories.json")
  const ids: number[] = await res.json()
  const top = ids.slice(0, 30)

  const items = await Promise.all(
    top.map(async (id) => {
      const r = await myFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
      return r.json()
    })
  )

  return items
    .filter((s) => s && s.title && s.url)
    .map((s) => {
      // Use the linked site's favicon as a tiny visual identifier — Google's
      // s2 favicons service is free, fast, no auth.
      let image: string | undefined
      try {
        const host = new URL(s.url).hostname
        image = `https://www.google.com/s2/favicons?domain=${host}&sz=128`
      } catch {
        // ignore unparseable URLs
      }
      return {
        id: String(s.id),
        title: s.title,
        url: s.url,
        extra: `▲${s.score}  ${s.descendants ?? 0} comments`,
        image,
      }
    })
}
