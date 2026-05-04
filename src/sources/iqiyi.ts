import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "iqiyi", icon: "🎥",
  accentColor: "bg-gradient-to-r from-green-500 to-teal-400",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://mesh.if.iqiyi.com/portal/lw/v7/channel/card/videoTab?channelName=recommend&data_source=v7_rec_sec_hot_rank_list&tempId=85&count=30&block_id=hot_ranklist&device=14a4b5ba98e790dce6dc07482447cf48&from=webapp",
    { headers: { Referer: "https://www.iqiyi.com/" } }
  )
  const data = await res.json()
  const items: NewsItem[] = []
  for (const item of data?.items ?? []) {
    for (const video of item?.video ?? []) {
      for (const v of video?.data ?? []) {
        if (v?.title && !v?.isAd) {
          items.push({
            id: `iqiyi-${v.tv_id || v.album_id || items.length}`,
            title: v.title,
            url: v.page_url ?? v.url ?? `https://www.iqiyi.com/`,
            extra: v.hot_score ? `🔥 ${Number(v.hot_score).toLocaleString()}` : undefined,
          })
        }
      }
    }
  }
  return items.slice(0, 30)
}
