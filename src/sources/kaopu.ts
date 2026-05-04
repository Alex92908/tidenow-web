import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "kaopu", icon: "✅",
  accentColor: "bg-gradient-to-r from-teal-500 to-cyan-400",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://kaopustorage.blob.core.windows.net/news-prod/news_list_hans_0.json"
  )
  const data: Array<{
    link: string; title: string; description: string; publisher: string; pub_date: string
  }> = await res.json()
  return data
    .filter((k) => !["财新", "公视"].includes(k.publisher))
    .slice(0, 25)
    .map((k, i) => ({
      id: `kaopu-${i}`,
      title: k.title,
      url: k.link,
      extra: k.publisher,
    }))
}
