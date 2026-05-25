import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "36kr",
  icon: "💡",
  accentColor: "bg-gradient-to-r from-blue-400 to-cyan-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

interface HotRankItem {
  itemId: number
  route?: string
  templateMaterial?: {
    widgetTitle: string
    widgetImage?: string
    authorName?: string
    statRead?: number
  }
}

// 36kr 的「热榜」JSON 接口比 RSS 信息丰富（带 widgetImage 封面图）。
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://gateway.36kr.com/api/mis/nav/home/nav/rank/hot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://36kr.com/",
    },
    body: JSON.stringify({
      partner_id: "wap",
      param: { siteId: 1, platformId: 2 },
      timestamp: 1,
      key: "a",
    }),
  })
  const data = (await res.json()) as { data?: { hotRankList?: HotRankItem[] } }
  const list = data.data?.hotRankList ?? []
  return list.slice(0, 25).map((item) => ({
    id: `36kr-${item.itemId}`,
    title: item.templateMaterial?.widgetTitle ?? "",
    url: `https://36kr.com/p/${item.itemId}`,
    extra: item.templateMaterial?.statRead
      ? `👁 ${item.templateMaterial.statRead.toLocaleString()}`
      : item.templateMaterial?.authorName,
    image: item.templateMaterial?.widgetImage,
  }))
}
