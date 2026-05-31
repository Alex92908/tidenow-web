import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "twitter",
  icon: "𝕏",
  accentColor: "bg-gradient-to-r from-gray-900 to-gray-600",
  // trends24 takes hourly snapshots — 30 min keeps us fresh without hammering
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 30,
}

// X/Twitter killed the public trends endpoint, and the v2 API costs $5000/mo
// for it. trends24.in scrapes X for ~50 countries and serves the latest list
// as plain HTML — first <ol class="trend-card__list"> on the page is the
// most-recent snapshot. We parse that and link each trend back to X search,
// which is the same thing trends24 does.
export async function fetch(): Promise<NewsItem[]> {
  // X has no real "worldwide" trends — the data is always per-WOEID. We pin
  // to United States as the canonical English-language trend pool; the home
  // page flips between countries hour to hour which is not what users expect.
  const res = await myFetch("https://trends24.in/united-states/", {
    headers: { Accept: "text/html,application/xhtml+xml" },
  })
  if (!res.ok) throw new Error(`trends24 ${res.status}`)
  const html = await res.text()

  // Grab the first ordered list — it is the freshest hourly snapshot.
  const listMatch = html.match(
    /<ol\s+class=["']?trend-card__list["']?[^>]*>([\s\S]*?)<\/ol>/i
  )
  if (!listMatch) return []
  const block = listMatch[1]

  // Each row: <a href="https://twitter.com/search?q=NAME" class="trend-link">DISPLAY</a>
  const rowRe =
    /<a[^>]+href=["']([^"']+)["'][^>]*class=["']?trend-link["']?[^>]*>([\s\S]*?)<\/a>/gi
  const out: NewsItem[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(block)) !== null) {
    const url = decodeEntities(m[1])
    const title = decodeEntities(stripTags(m[2])).trim()
    if (!title || seen.has(title)) continue
    seen.add(title)
    out.push({
      id: title,
      title,
      url,
    })
    if (out.length >= 50) break
  }
  return out
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "")
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}
