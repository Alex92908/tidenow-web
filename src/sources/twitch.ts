import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "twitch",
  icon: "🟣",
  accentColor: "bg-gradient-to-r from-purple-600 to-violet-500",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "entertainment",
}

// In-memory cache of Twitch app access token. App tokens last ~60 days; we
// refresh proactively when within 5 minutes of expiry, and reactively on 401.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - now > 5 * 60_000) {
    return cachedToken.value
  }
  const res = await myFetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  )
  if (!res.ok) throw new Error(`Twitch token fetch failed (${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return data.access_token
}

interface TwitchGame {
  id: string
  name: string
  igdb_id?: string
}

export async function fetch(): Promise<NewsItem[]> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.warn("[twitch] TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set — skipping")
    return []
  }
  const token = await getAppToken(clientId, clientSecret)
  const res = await myFetch("https://api.twitch.tv/helix/games/top?first=25", {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
  if (res.status === 401) {
    // Token rejected — clear cache so the next call re-fetches
    cachedToken = null
  }
  const data = (await res.json()) as { data: TwitchGame[] }
  return data.data.map((g, i) => ({
    id: `twitch-${g.id}`,
    title: g.name,
    url: `https://www.twitch.tv/directory/category/${encodeURIComponent(
      g.name.toLowerCase().replace(/\s+/g, "-")
    )}`,
    extra: `#${i + 1}`,
  }))
}
