import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "spotify",
  icon: "🎧",
  accentColor: "bg-gradient-to-r from-green-500 to-emerald-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "global",
}

// Kworb mirrors Spotify's daily charts as plain HTML tables (no auth).
// Global Daily Top 200: https://kworb.net/spotify/country/global_daily.html
// Row shape:
//   <tr><td class="np">1</td><td class="np">=</td>
//   <td class="text mp"><div><a href="../artist/...">ARTIST</a> -
//   <a href="../track/{SPOTIFY_TRACK_ID}.html">TITLE</a></div></td> ...
const ROW_RE =
  /<tr>\s*<td class="np">(\d+)<\/td>\s*<td class="np">([^<]*)<\/td>\s*<td class="text mp"><div>([\s\S]*?)<\/div><\/td>/g
const TRACK_RE = /\.\.\/track\/([A-Za-z0-9]+)\.html/

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://kworb.net/spotify/country/global_daily.html",
    { headers: { Accept: "text/html" } }
  )
  if (!res.ok) return []
  const html = await res.text()
  const out: NewsItem[] = []
  for (const m of html.matchAll(ROW_RE)) {
    const rank = Number(m[1])
    const trackId = TRACK_RE.exec(m[3])?.[1]
    const title = stripTags(m[3])
    if (!trackId || !title) continue
    out.push({
      id: `spotify|${trackId}`,
      title,
      url: `https://open.spotify.com/track/${trackId}`,
      extra: `#${rank}`,
    })
    if (out.length >= 25) break
  }
  return out
}
