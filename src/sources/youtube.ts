import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "youtube",
  icon: "▶️",
  accentColor: "bg-gradient-to-r from-red-500 to-pink-500",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  const res = await myFetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=30&key=${apiKey}`
  )
  const data = await res.json()
  return data.items.map(
    (v: {
      id: string
      snippet: {
        title: string
        channelTitle: string
        thumbnails?: {
          default?: { url?: string }
          medium?: { url?: string }
          high?: { url?: string }
        }
      }
      statistics: { viewCount: string }
    }) => ({
      id: v.id,
      title: v.snippet.title,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      extra: `${v.snippet.channelTitle} · ${Number(v.statistics.viewCount).toLocaleString()} views`,
      image:
        v.snippet.thumbnails?.medium?.url ??
        v.snippet.thumbnails?.high?.url ??
        v.snippet.thumbnails?.default?.url,
    })
  )
}
