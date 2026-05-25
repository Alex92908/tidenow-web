import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "anilist",
  icon: "🌸",
  accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
  interval: 60 * 60 * 1000, // anime trending changes slowly
  defaultCount: 10,
  expandCount: 25,
  column: "entertainment",
}

// AniList GraphQL — fully public, no auth required.
const QUERY = `
query {
  Page(page: 1, perPage: 25) {
    media(sort: TRENDING_DESC, type: ANIME) {
      id
      title { romaji english native }
      siteUrl
      averageScore
      trending
      coverImage { medium }
    }
  }
}`

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: QUERY }),
  })
  const data = (await res.json()) as {
    data: {
      Page: {
        media: Array<{
          id: number
          title: { romaji?: string; english?: string; native?: string }
          siteUrl: string
          averageScore?: number
          trending?: number
          coverImage?: { medium?: string }
        }>
      }
    }
  }
  return data.data.Page.media.map((m) => ({
    id: `anilist-${m.id}`,
    title: m.title.english ?? m.title.romaji ?? m.title.native ?? "",
    url: m.siteUrl,
    extra:
      m.averageScore != null ? `★ ${m.averageScore} · 🔥 ${m.trending ?? 0}` : undefined,
    image: m.coverImage?.medium,
  }))
}
