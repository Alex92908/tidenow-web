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

// Bilibili 美食区（rid=211）热门视频。原来的 region 动态接口
// (dynamic/region) 现在对数据中心 IP 返回非零 code（疑似 WBI 校验），
// 改用 ranking v2 接口，实测 2026-11-15 可用、无需签名，返回结构
// 与 region 接口一致（bvid/title/pic/owner/stat）。
export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.bilibili.com/x/web-interface/ranking/v2?rid=211&type=all",
    { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }
  )
  const data = (await res.json()) as {
    code: number
    data?: { list?: BiliArchive[] }
  }
  if (data.code !== 0 || !data.data?.list) return []
  return data.data.list.slice(0, 25).map((v) => {
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
