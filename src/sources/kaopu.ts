import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "kaopu", icon: "✅",
  accentColor: "bg-gradient-to-r from-teal-500 to-cyan-400",
  interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://kaopustorage.blob.core.windows.net/news-prod/news_list_hans_0.json"
  )
  const data: Array<{
    link: string; title: string; description: string; publisher: string; pub_date: string
  }> = await res.json()

  const cutoff = Date.now() - FRESH_WINDOW_MS
  const enriched = data
    .filter((k) => !["财新", "公视"].includes(k.publisher))
    .map((k) => ({ ...k, _ts: Date.parse(k.pub_date) || 0 }))
    .sort((a, b) => b._ts - a._ts)

  // Prefer items in the last 48h; if none qualify (unlikely but possible),
  // fall back to the freshest 10 so the card never goes empty.
  const fresh = enriched.filter((k) => k._ts >= cutoff)
  const pool = fresh.length > 0 ? fresh : enriched.slice(0, 10)

  return pool.slice(0, 25).map((k, i) => ({
    id: `kaopu-${i}`,
    title: k.title,
    url: k.link,
    extra: k.publisher,
  }))
}
