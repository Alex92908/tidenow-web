import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "cls", icon: "📡",
  accentColor: "bg-gradient-to-r from-red-500 to-rose-400",
  interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://www.cls.cn/nodeapi/updateTelegraphList?app=CailianpressWeb&os=web&sv=7.7.5",
    { headers: { Referer: "https://www.cls.cn/" } }
  )
  const data = await res.json()
  return (data?.data?.roll_data ?? [])
    .filter((k: { is_ad?: number }) => !k.is_ad)
    .slice(0, 30)
    .map((k: { id: number; title?: string; brief?: string; content?: string; ctime?: number }) => {
      const raw = k.title || k.brief || k.content || ""
      // content is like 【title】desc — extract title from brackets
      const bracketMatch = raw.match(/^【([^】]+)】/)
      const title = bracketMatch ? bracketMatch[1] : raw.substring(0, 60)
      return {
        id: `cls-${k.id}`,
        title,
        url: `https://www.cls.cn/detail/${k.id}`,
      }
    })
}
