import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "qqmusic",
  icon: "🎵",
  accentColor: "bg-gradient-to-r from-green-600 to-lime-500",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "china",
}

// QQ Music 巅峰榜·热歌 (topid=26) — public toplist API, no auth.
// https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?tpl=3&page=detail&type=top&topid=26
type QQSong = {
  songname?: string
  songmid?: string
  albummid?: string
  singer?: { name?: string }[]
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?tpl=3&page=detail&type=top&topid=26",
    { headers: { Referer: "https://y.qq.com/" } }
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    code?: number
    songlist?: { data?: QQSong }[]
  }
  if (data.code !== 0 || !Array.isArray(data.songlist)) return []
  const out: NewsItem[] = []
  for (const entry of data.songlist.slice(0, 25)) {
    const s = entry.data
    if (!s?.songmid || !s.songname) continue
    const singers = (s.singer ?? [])
      .map((x) => x.name)
      .filter(Boolean)
      .join(" / ")
    out.push({
      id: `qqmusic|${s.songmid}`,
      title: singers ? `${singers} - ${s.songname}` : s.songname,
      url: `https://y.qq.com/n/ryqq/songDetail/${s.songmid}`,
      extra: `#${out.length + 1}`,
      image: s.albummid
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg`
        : undefined,
      imageLarge: s.albummid
        ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${s.albummid}.jpg`
        : undefined,
    })
  }
  return out
}
