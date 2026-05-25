import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "steam", icon: "🎮",
  accentColor: "bg-gradient-to-r from-indigo-500 to-blue-400",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://store.steampowered.com/search/results/?filter=topsellers&json=1&count=25",
    { headers: { Referer: "https://store.steampowered.com/" } }
  )
  const data = await res.json()
  return (data?.items ?? []).map(
    (item: { name: string; logo: string }, i: number) => {
      const appIdMatch = item.logo?.match(/\/apps\/(\d+)\//)
      const appId = appIdMatch?.[1]
      return {
        id: `steam-${i}`,
        title: item.name,
        url: appId
          ? `https://store.steampowered.com/app/${appId}/`
          : "https://store.steampowered.com/charts/topselling/",
        image: item.logo,
      }
    }
  )
}
