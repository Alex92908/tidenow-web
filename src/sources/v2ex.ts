import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "v2ex", icon: "🖖",
  accentColor: "bg-gradient-to-r from-slate-500 to-zinc-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

const FEEDS = ["create", "ideas", "programmer", "share"]

export async function fetch(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map((f) => myFetch(`https://www.v2ex.com/feed/${f}.json`).then((r) => r.json()))
  )
  const items: NewsItem[] = []
  for (const r of results) {
    if (r.status !== "fulfilled") continue
    for (const item of (r.value.items ?? []) as {
      id: string
      title: string
      url: string
      date_modified?: string
      date_published?: string
      author?: { avatar?: string }
      content_html?: string
    }[]) {
      // Prefer the first inline <img> from the post body; fall back to
      // the poster's gravatar so every row has visual identity.
      const inlineImg = item.content_html?.match(/<img[^>]+src=["']([^"']+)["']/)?.[1]
      items.push({
        id: item.id,
        title: item.title,
        url: item.url,
        image: inlineImg || item.author?.avatar,
      })
    }
  }
  return items.slice(0, 50)
}
