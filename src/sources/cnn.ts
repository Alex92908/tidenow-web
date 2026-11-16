import { myFetch } from "@/lib/fetch"
import { decodeXmlEntities, extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "cnn",
  icon: "📡",
  accentColor: "bg-gradient-to-r from-red-700 to-red-500",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

// CNN's own RSS (rss.cnn.com/rss/edition.rss) is a frozen file from
// ~April 2023 — the endpoint was deprecated and now serves a stale
// snapshot. Verified 2026-11-15: HTTP 200 but newest pubDate is
// 2023-04-05. There is no working live CNN RSS, so we use Google News
// RSS scoped to cnn.com, which is fresh (verified same day). Titles get
// the " - CNN" suffix stripped; links are Google News redirects that
// land on cnn.com.
const FEED_URL =
  "https://news.google.com/rss/search?q=site%3Acnn.com&hl=en-US&gl=US&ceid=US%3Aen"

// A feed whose newest item is older than this is treated as stale and
// returns [] so the API route's failure path (stale cache / pending)
// handles it instead of presenting old news as fresh.
const FRESHNESS_MS = 48 * 60 * 60 * 1000

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(FEED_URL, {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  let newest = 0
  for (const match of entries) {
    const block = match[1]
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ""
    // Google News appends " - CNN" to some titles; strip it for a clean
    // headline. Decode entities (titles can carry &amp; etc.).
    const title = decodeXmlEntities(rawTitle).replace(/\s+-\s*CNN\s*$/i, "").trim()
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ""
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim()
    const ts = pubDate ? Date.parse(pubDate) : NaN
    if (!Number.isNaN(ts) && ts > newest) newest = ts
    // Description is an entity-encoded HTML anchor whose text is just the
    // headline + a "CNN" source label — decode first, then strip tags
    // (same order as theguardian.ts). The anchor text repeats the title,
    // so drop the duplicated leading portion and the source suffix; a
    // snippet that adds nothing is dropped entirely (extra: undefined).
    // &nbsp; arrives double-encoded (&amp;nbsp;) so it survives one
    // decode pass as a literal "&nbsp;" — turn it into a real space.
    const rawDesc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
    let desc: string | undefined
    if (rawDesc) {
      let cleaned = decodeXmlEntities(rawDesc)
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#160;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      if (cleaned) {
        // Compare separator-flattened forms: Google's anchor text and the
        // <title> can differ by a " - " vs " " (e.g. "... Programming -
        // CNN Press Room" vs "... Programming CNN Press Room"), which
        // would defeat a plain prefix check.
        const flat = (s: string) => s.replace(/[\s\-–—·|]+/g, " ").trim()
        const titleFlat = flat(title)
        const descFlat = flat(cleaned)
        if (
          title &&
          (descFlat.startsWith(titleFlat) || titleFlat.startsWith(descFlat))
        ) {
          // The description is the headline (or a prefix of it). Keep
          // only whatever substantive text follows the headline, if any
          // (in this feed there is none — just source labels).
          const rest = descFlat
            .slice(titleFlat.length)
            .replace(/CNN/gi, "")
            .replace(/\s+/g, " ")
            .trim()
          desc = rest.slice(0, 80).trim() || undefined
        } else {
          // Independent snippet text: only the trailing <font>CNN</font>
          // source label is noise.
          cleaned = cleaned.replace(/\s+CNN\s*$/i, "").trim()
          desc = cleaned.slice(0, 80).trim() || undefined
        }
      }
    }
    if (title && link) {
      items.push({ id: `cnn-${i}`, title, url: link, extra: desc || undefined, image: extractImageFromRss(block) })
    }
    i++
  }
  // Freshness guard: a frozen upstream must not be served as fresh news.
  if (items.length > 0 && newest > 0 && Date.now() - newest > FRESHNESS_MS) {
    return []
  }
  return items
}
