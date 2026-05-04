import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "reddit",
  icon: "🤖",
  accentColor: "bg-gradient-to-r from-orange-400 to-red-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

async function getAccessToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID
  const secret = process.env.REDDIT_CLIENT_SECRET
  if (!id || !secret) return null
  const res = await myFetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "TideNow/1.0 (by tidenow-web)",
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) return null
  const data = await res.json() as { access_token?: string }
  return data.access_token ?? null
}

export async function fetch(): Promise<NewsItem[]> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    "User-Agent": "TideNow/1.0 (by tidenow-web)",
    Accept: "application/json",
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const url = token
    ? "https://oauth.reddit.com/r/popular?limit=30"
    : "https://www.reddit.com/r/popular.json?limit=30"

  const res = await myFetch(url, { headers })
  const data = await res.json() as { data: { children: Array<{ data: { id: string; title: string; permalink: string; subreddit: string; score: number } }> } }
  return data.data.children.map((c) => ({
    id: c.data.id,
    title: c.data.title,
    url: `https://www.reddit.com${c.data.permalink}`,
    extra: `r/${c.data.subreddit} · ▲${c.data.score.toLocaleString()}`,
  }))
}
