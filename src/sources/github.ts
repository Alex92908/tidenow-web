import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "github",
  icon: "🐙",
  accentColor: "bg-gradient-to-r from-gray-500 to-gray-700",
  interval: 10 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.github.com/search/repositories?q=created:>2024-01-01&sort=stars&order=desc&per_page=30",
    { headers: { Accept: "application/vnd.github+json" } }
  )
  const data = await res.json()
  return data.items.map((r: { full_name: string; html_url: string; description: string; stargazers_count: number; owner: { avatar_url: string } }) => ({
    id: r.full_name,
    title: r.full_name,
    url: r.html_url,
    extra: r.description
      ? `★${r.stargazers_count.toLocaleString()}  ${r.description.slice(0, 60)}`
      : `★${r.stargazers_count.toLocaleString()}`,
    // Use the owner avatar as the thumbnail — sharper than the auto-generated
    // OG social card and loads instantly from GitHub's CDN.
    image: r.owner.avatar_url,
  }))
}
