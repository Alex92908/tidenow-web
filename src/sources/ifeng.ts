import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "ifeng", icon: "🦅",
  accentColor: "bg-gradient-to-r from-orange-600 to-red-400",
  interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://news.ifeng.com/", {
    headers: { Referer: "https://www.ifeng.com/" },
  })
  const html = await res.text()

  const m = html.match(/var allData\s*=\s*({[\s\S]*?});\s*(?:var|window|<\/script>)/)
  if (m) {
    try {
      const allData = JSON.parse(m[1])
      // newsstream array contains live top news items
      const stream: {
        id?: string
        title?: string
        url?: string
        thumbnails?: { image?: { url?: string }[] }
      }[] = allData?.newsstream ?? allData?.realData?.hotNews1 ?? []
      const items = stream
        .filter((item) => item.title && item.url)
        .slice(0, 30)
        .map((item, i) => ({
          id: `ifeng-${item.id ?? i}`,
          title: item.title!,
          url: item.url!,
          image: item.thumbnails?.image?.[0]?.url,
        }))
      if (items.length > 0) return items
    } catch { /* fall through */ }
  }
  return []
}
