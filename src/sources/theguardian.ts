import { myFetch } from "@/lib/fetch"
import { decodeXmlEntities, extractImageFromRss } from "@/lib/rss"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "theguardian",
  icon: "🔵",
  accentColor: "bg-gradient-to-r from-blue-700 to-cyan-500",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://www.theguardian.com/world/rss", {
    headers: { Accept: "application/rss+xml, text/xml" },
  })
  const xml = await res.text()
  const items: NewsItem[] = []
  const entries = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  let i = 0
  for (const match of entries) {
    const block = match[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
      ?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() ?? ""
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
      ?? block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ?? ""
    // The Guardian double-encodes its <description> HTML
    // (&lt;p&gt;...), so decode entities FIRST and only then strip tags.
    // Stripping first is a no-op (there are no literal < > chars), and
    // decoding only &amp; leaves the literal "&lt;p&gt;" text in the UI.
    const rawDesc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
    const desc = rawDesc
      ? decodeXmlEntities(rawDesc).replace(/<[^>]+>/g, "").trim().slice(0, 80)
      : undefined
    if (title && link) {
      items.push({ id: `guardian-${i}`, title, url: link, extra: desc || undefined })
    }
    i++
  }
  return items
}
