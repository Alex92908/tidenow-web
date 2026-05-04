import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "jin10", icon: "🥇",
  accentColor: "bg-gradient-to-r from-yellow-400 to-amber-300",
  interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    `https://www.jin10.com/flash_newest.js?t=${Date.now()}`,
    { headers: { Referer: "https://www.jin10.com/" } }
  )
  const raw = await res.text()
  const jsonStr = raw.replace(/^var\s+newest\s*=\s*/, "").replace(/;*$/, "").trim()
  const data: Array<{
    id: string
    data: { title?: string; content?: string }
    important?: number
    channel?: number[]
  }> = JSON.parse(jsonStr)

  return data
    .filter((k) => (k.data.title || k.data.content) && !k.channel?.includes(5))
    .slice(0, 30)
    .map((k) => {
      const text = (k.data.title || k.data.content)!.replace(/<\/?b>/g, "")
      const [, bracketTitle] = text.match(/^【([^】]*)】/) ?? []
      const title = bracketTitle ?? text.substring(0, 60)
      return {
        id: `jin10-${k.id}`,
        title,
        url: `https://flash.jin10.com/detail/${k.id}`,
        extra: k.important ? "⭐ 重要" : undefined,
      }
    })
}
