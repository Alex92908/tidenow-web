import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "tmdb-tv",
  icon: "📽️",
  accentColor: "bg-gradient-to-r from-teal-500 to-emerald-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "entertainment",
}

interface TmdbTv {
  id: number
  name: string
  original_name: string
  vote_average: number
  first_air_date: string
}

export async function fetch(): Promise<NewsItem[]> {
  const key = process.env.TMDB_API_KEY
  if (!key) {
    console.warn("[tmdb-tv] TMDB_API_KEY not set — skipping")
    return []
  }
  const res = await myFetch(
    `https://api.themoviedb.org/3/trending/tv/day?api_key=${key}&language=en-US`,
    { headers: { Accept: "application/json" } }
  )
  const data = (await res.json()) as { results: TmdbTv[] }
  return data.results.slice(0, 25).map((m) => ({
    id: `tmdb-tv-${m.id}`,
    title: m.name || m.original_name,
    url: `https://www.themoviedb.org/tv/${m.id}`,
    extra: m.vote_average ? `★ ${m.vote_average.toFixed(1)}` : m.first_air_date,
  }))
}
