import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "hongguo",
  icon: "🍅",
  accentColor: "bg-gradient-to-r from-red-500 to-orange-400",
  interval: 30 * 60 * 1000,
  defaultCount: 10,
  expandCount: 20,
  column: "china",
}

// 红果热搜榜 — the official ranking page embeds the full top 20 as
// JSON-LD (schema.org ItemList) in the HTML, so no app-API signing is
// needed: https://hongguoduanju.com/rank/hot-search-drama
// Each ListItem: { "@type": "ListItem", position, name,
//   url: "https://hongguoduanju.com/detail?series_id=...",
//   image: "https://p3-novel.byteimg.com/novel-pic/...~tplv-shrink:640:0.image" }
type ListItem = {
  "@type"?: string
  position?: number
  name?: string
  url?: string
  image?: string
}

function collectListItems(node: unknown, out: ListItem[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectListItems(item, out)
    return
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>
    if (obj["@type"] === "ListItem") out.push(obj as unknown as ListItem)
    for (const value of Object.values(obj)) collectListItems(value, out)
  }
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://hongguoduanju.com/rank/hot-search-drama", {
    headers: { Accept: "text/html" },
  })
  if (!res.ok) return []
  const html = await res.text()
  const items: ListItem[] = []
  for (const m of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )) {
    try {
      collectListItems(JSON.parse(m[1]), items)
    } catch {
      // A malformed block must not kill the whole fetch.
    }
  }
  // The page embeds two ld+json blocks: a 3-item breadcrumb trail
  // (首页 / 全部 / 热搜榜) and the 20-item drama ranking. Only the
  // drama detail links (series_id=…) belong on the card.
  const dramas = items.filter(
    (it) => it.name && it.url && /series_id=\d+/.test(it.url)
  )
  if (dramas.length === 0) return []
  dramas.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return dramas.slice(0, 20).map((it) => {
    const seriesId = /series_id=(\d+)/.exec(it.url ?? "")?.[1]
    return {
      id: `hongguo|${seriesId ?? it.position ?? it.name}`,
      title: it.name ?? "",
      url: it.url ?? "https://hongguoduanju.com/rank/hot-search-drama",
      extra: it.position ? `#${it.position}` : undefined,
      image: it.image,
      imageLarge: it.image,
    }
  })
}
