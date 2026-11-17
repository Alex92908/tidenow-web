import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "billboard",
  icon: "🏆",
  accentColor: "bg-gradient-to-r from-slate-700 to-slate-500",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "global",
}

// Billboard Hot 100 — the chart rows are server-rendered in the HTML
// (https://www.billboard.com/charts/hot-100/, ~3MB page). Each row:
//   <div class="o-chart-results-list-row-container">
//     <ul class="o-chart-results-list-row ...">
//       <li><span class="c-label ...">1</span></li>           <- rank
//       <li><h3 class="c-title ...">TITLE</h3>
//           <span class="c-label ..."><a href="/artist/{slug}/">ARTIST</a></span></li>
// The row carries no per-song URL, so each item links to the artist's
// Billboard page.
function decodeEntities(s: string): string {
  return s
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.billboard.com/charts/hot-100/", {
    headers: { Accept: "text/html" },
  })
  if (!res.ok) return []
  const html = await res.text()
  const out: NewsItem[] = []
  const blocks = html.split("o-chart-results-list-row-container")
  for (const block of blocks.slice(1)) {
    const rank = /<span class="c-label[^>]*>\s*(\d+)\s*<\/span>/.exec(block)?.[1]
    const titleRaw = /<h3[^>]*class="[^"]*c-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/.exec(block)?.[1]
    const artist = /<span[^>]*class="[^"]*c-label[^"]*"[^>]*>\s*<a href="([^"]+)">([^<]+)<\/a>/.exec(block)
    if (!rank || !titleRaw || !artist) continue
    const title = decodeEntities(
      titleRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    )
    const artistName = artist[2].trim()
    if (!title || !artistName) continue
    out.push({
      id: `billboard|${slugify(`${artistName}-${title}`)}`,
      title: `${artistName} - ${title}`,
      url: artist[1].startsWith("http")
        ? artist[1]
        : `https://www.billboard.com${artist[1]}`,
      extra: `#${rank}`,
    })
    if (out.length >= 25) break
  }
  return out
}
