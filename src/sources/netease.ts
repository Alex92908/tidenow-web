import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "netease",
  icon: "🎶",
  accentColor: "bg-gradient-to-r from-red-500 to-rose-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "china",
}

// 网易云音乐热歌榜 — public playlist API, no auth.
// 3778678 is the long-standing 热歌榜 playlist id.
// https://music.163.com/api/playlist/detail?id=3778678
type NetEaseTrack = {
  id?: number
  name?: string
  artists?: { name?: string }[]
  album?: { picUrl?: string }
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://music.163.com/api/playlist/detail?id=3778678"
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    code?: number
    result?: { tracks?: NetEaseTrack[] }
  }
  if (data.code !== 200 || !Array.isArray(data.result?.tracks)) return []
  const out: NewsItem[] = []
  for (const t of data.result.tracks.slice(0, 25)) {
    if (!t.id || !t.name) continue
    const singers = (t.artists ?? [])
      .map((a) => a.name)
      .filter(Boolean)
      .join(" / ")
    // Covers come back over plain http; force https for the browser.
    const cover = t.album?.picUrl?.replace(/^http:\/\//, "https://")
    out.push({
      id: `netease|${t.id}`,
      title: singers ? `${singers} - ${t.name}` : t.name,
      url: `https://music.163.com/#/song?id=${t.id}`,
      extra: `#${out.length + 1}`,
      image: cover,
      imageLarge: cover,
    })
  }
  return out
}
