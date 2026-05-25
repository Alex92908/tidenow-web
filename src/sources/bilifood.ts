import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "bilifood",
  icon: "🍜",
  accentColor: "bg-gradient-to-r from-orange-500 to-red-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "china",
}

interface BiliArchive {
  aid: number
  bvid: string
  title: string
  pic: string
  owner: { name: string }
  stat: { view: number }
}

// Bilibili 美食区（rid=211）最新视频。不需要 auth / WBI 签名。
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.bilibili.com/x/web-interface/dynamic/region?ps=25&rid=211",
    { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }
  )
  const data = (await res.json()) as {
    code: number
    data?: { archives?: BiliArchive[] }
  }
  if (data.code !== 0 || !data.data?.archives) return []
  return data.data.archives.slice(0, 25).map((v) => {
    const views =
      v.stat.view >= 10000
        ? `${(v.stat.view / 10000).toFixed(1)}万播放`
        : `${v.stat.view} 播放`
    // Bilibili 的 pic 默认是 http，统一升 https；规避 next/image 拒绝混合内容
    const image = v.pic ? v.pic.replace(/^http:\/\//, "https://") : undefined
    return {
      id: `bilifood-${v.bvid}`,
      title: v.title,
      url: `https://www.bilibili.com/video/${v.bvid}`,
      extra: `${v.owner.name} · ${views}`,
      image,
    }
  })
}
