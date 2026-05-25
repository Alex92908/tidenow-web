import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "bilibili",
  icon: "📺",
  accentColor: "bg-gradient-to-r from-pink-500 to-rose-400",
  interval: 10 * 60 * 1000,
  defaultCount: 10,
  expandCount: 30,
}

interface BiliPopularVideo {
  aid: number
  bvid: string
  title: string
  pic: string
  owner: { name: string }
  stat: { view: number; danmaku: number }
}

// Bilibili 热门视频（全站综合排行）— 替代原来的"热搜词"接口，
// 因为视频接口能给缩略图，体验比纯文字关键词好得多。
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.bilibili.com/x/web-interface/popular?ps=30&pn=1",
    { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.bilibili.com/" } }
  )
  const data = (await res.json()) as {
    code: number
    data?: { list?: BiliPopularVideo[] }
  }
  if (data.code !== 0 || !data.data?.list) return []
  return data.data.list.slice(0, 30).map((v) => {
    const views = v.stat.view >= 10000
      ? `${(v.stat.view / 10000).toFixed(1)}万播放`
      : `${v.stat.view} 播放`
    return {
      id: `bilibili-${v.bvid}`,
      title: v.title,
      url: `https://www.bilibili.com/video/${v.bvid}`,
      extra: `${v.owner.name} · ${views}`,
      image: v.pic ? v.pic.replace(/^http:\/\//, "https://") : undefined,
    }
  })
}
