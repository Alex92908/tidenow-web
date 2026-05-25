import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "tmdb-movies",
  icon: "🎬",
  accentColor: "bg-gradient-to-r from-emerald-500 to-teal-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "entertainment",
}

interface TmdbMovie {
  id: number
  title: string
  original_title: string
  vote_average: number
  release_date: string
  poster_path?: string | null
}

export async function fetch(): Promise<NewsItem[]> {
  const key = process.env.TMDB_API_KEY
  if (!key) {
    console.warn("[tmdb-movies] TMDB_API_KEY not set — skipping")
    return []
  }
  const res = await myFetch(
    `https://api.themoviedb.org/3/trending/movie/day?api_key=${key}&language=en-US`,
    { headers: { Accept: "application/json" } }
  )
  const data = (await res.json()) as { results: TmdbMovie[] }
  return data.results.slice(0, 25).map((m) => ({
    id: `tmdb-movie-${m.id}`,
    title: m.title || m.original_title,
    url: `https://www.themoviedb.org/movie/${m.id}`,
    extra: m.vote_average ? `★ ${m.vote_average.toFixed(1)}` : m.release_date,
    image: m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : undefined,
  }))
}
