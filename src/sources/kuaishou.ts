import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "kuaishou", icon: "⚡",
  accentColor: "bg-gradient-to-r from-orange-400 to-yellow-300",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const body = JSON.stringify({
    operationName: "visionHotRank",
    variables: {},
    query: "query visionHotRank { visionHotRank { items { name viewCount } } }",
  })
  const res = await myFetch("https://www.kuaishou.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://www.kuaishou.com/" },
    body,
  })
  const data = await res.json()
  return (data?.data?.visionHotRank?.items ?? []).map(
    (item: { name: string; viewCount?: number }, i: number) => ({
      id: `ks-${i}`,
      title: item.name,
      url: `https://www.kuaishou.com/search/video?searchKey=${encodeURIComponent(item.name)}`,
      extra: item.viewCount ? `🔥 ${item.viewCount.toLocaleString()}` : undefined,
    })
  )
}
