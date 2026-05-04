import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "spotify",
  icon: "🎵",
  accentColor: "bg-gradient-to-r from-green-400 to-emerald-400",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://kworb.net/spotify/country/global_daily.html")
  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NewsItem[] = []

  $("table tbody tr").each((i, el) => {
    // Structure: rank | change | artist - track | streams | ...
    const titleCell = $(el).find("td.text, td.mp, td:nth-child(3)").first()
    const links = $(el).find("a")
    if (links.length < 2) return

    const artist = links.eq(0).text().trim()
    const track = links.eq(1).text().trim()
    const trackHref = links.eq(1).attr("href") ?? ""
    const cells = $(el).find("td")
    const streams = cells.eq(3).text().trim() || cells.eq(4).text().trim()

    if (!track) return
    const title = artist ? `${artist} - ${track}` : track
    items.push({
      id: `spotify-${i}`,
      title,
      url: trackHref
        ? `https://kworb.net/spotify/${trackHref.replace(/^\.\.\//, "")}`
        : "https://kworb.net/spotify/",
      extra: streams ? `${streams} streams` : undefined,
    })
  })
  return items
}
