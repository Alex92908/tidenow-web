import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "nowcoder", icon: "💻",
  accentColor: "bg-gradient-to-r from-green-500 to-emerald-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    `https://gw-c.nowcoder.com/api/sparta/hot-search/top-hot-pc?size=25&_=${Date.now()}&t=`,
    { headers: { Referer: "https://www.nowcoder.com/" } }
  )
  const data = await res.json()
  return (data?.data?.result ?? []).map(
    (k: { id: string; uuid: string; title: string; type: number }, i: number) => {
      const url = k.type === 74
        ? `https://www.nowcoder.com/feed/main/detail/${k.uuid}`
        : `https://www.nowcoder.com/discuss/${k.id}`
      return { id: `nowcoder-${k.uuid || k.id || i}`, title: k.title, url }
    }
  )
}
