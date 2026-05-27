import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "wallstreetcn", icon: "📈",
  accentColor: "bg-gradient-to-r from-amber-500 to-yellow-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api-one.wallstcn.com/apiv1/content/articles/hot?period=all",
    { headers: { Referer: "https://wallstreetcn.com/" } }
  )
  const data = await res.json()
  const items = data?.data?.day_items ?? data?.data?.items ?? []
  return items
    .filter((item: { resource_type?: string }) => item.resource_type !== "theme" && item.resource_type !== "ad")
    .map((item: { id: string; title: string; uri?: string }) => {
      // The API returns `uri` as a fully-qualified URL ("https://wallstreetcn.com/articles/123")
      // most of the time, but occasionally as a relative path. Handle both
      // without double-prefixing.
      let url: string
      if (!item.uri) {
        url = `https://wallstreetcn.com/articles/${item.id}`
      } else if (/^https?:\/\//.test(item.uri)) {
        url = item.uri
      } else {
        url = `https://wallstreetcn.com${item.uri.startsWith("/") ? "" : "/"}${item.uri}`
      }
      return { id: `wsj-${item.id}`, title: item.title, url }
    })
}
