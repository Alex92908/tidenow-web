import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "juejin", icon: "⛏️",
  accentColor: "bg-gradient-to-r from-blue-500 to-sky-400",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot&spider=0",
    { headers: { Referer: "https://juejin.cn/" } }
  )
  const data = await res.json()
  return (data.data ?? []).map((item: {
    content: { content_id: string; title: string; view_count?: number }
    author?: { avatar?: string; name?: string }
  }) => ({
    id: `juejin-${item.content.content_id}`,
    title: item.content.title,
    url: `https://juejin.cn/post/${item.content.content_id}`,
    extra: item.content.view_count ? `👁 ${item.content.view_count.toLocaleString()}` : undefined,
    image: item.author?.avatar,
  }))
}
