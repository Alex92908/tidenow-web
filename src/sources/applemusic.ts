import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "applemusic",
  icon: "🎵",
  accentColor: "bg-gradient-to-r from-pink-500 to-rose-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "global",
}

type Chart = "songs" | "albums"
type Region = "us" | "gb" | "jp" | "cn"

const REGIONS: Record<Region, string[]> = {
  us: ["us"],
  gb: ["gb"],
  jp: ["jp"],
  // Greater China: mainland + HK + TW + MO, interleaved
  cn: ["cn", "hk", "tw", "mo"],
}

type AppleEntry = {
  id: string
  name: string
  artistName: string
  url: string
}

async function fetchOne(region: string, chart: Chart): Promise<AppleEntry[]> {
  const kind = chart === "songs" ? "songs" : "albums"
  const res = await myFetch(
    `https://rss.marketingtools.apple.com/api/v2/${region}/music/most-played/25/${kind}.json`,
    { headers: { Accept: "application/json" } }
  )
  if (!res.ok) return []
  const data = (await res.json()) as { feed: { results: AppleEntry[] } }
  return data.feed.results
}

// Round-robin interleave for Greater China merge, dedup by song id
function interleave(lists: AppleEntry[][]): AppleEntry[] {
  const seen = new Set<string>()
  const out: AppleEntry[] = []
  const max = Math.max(...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      const item = list[i]
      if (item && !seen.has(item.id)) {
        seen.add(item.id)
        out.push(item)
      }
    }
  }
  return out.slice(0, 25)
}

export async function fetch(): Promise<NewsItem[]> {
  const tasks: Array<Promise<{ chart: Chart; region: Region; items: AppleEntry[] }>> = []
  for (const chart of ["songs", "albums"] as Chart[]) {
    for (const region of Object.keys(REGIONS) as Region[]) {
      tasks.push(
        Promise.all(REGIONS[region].map((r) => fetchOne(r, chart)))
          .then((lists) => ({ chart, region, items: interleave(lists) }))
      )
    }
  }
  const results = await Promise.all(tasks)
  const out: NewsItem[] = []
  for (const { chart, region, items } of results) {
    items.forEach((s, i) => {
      out.push({
        // Encode segment in id so the card can group: applemusic|chart|region|songId
        id: `applemusic|${chart}|${region}|${s.id}`,
        title: `${s.artistName} - ${s.name}`,
        url: s.url,
        extra: `#${i + 1}`,
      })
    })
  }
  return out
}
