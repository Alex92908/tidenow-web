import { NextRequest, NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"
import type { NewsItem } from "@/lib/types"

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" })

function extractItems(xml: string): { title: string; items: NewsItem[] } {
  const doc = parser.parse(xml)

  // Support RSS 2.0 and Atom
  const channel = doc?.rss?.channel ?? doc?.feed
  const feedTitle: string =
    channel?.title?.["#text"] ?? channel?.title ?? "RSS Feed"

  const rawItems: unknown[] = Array.isArray(channel?.item)
    ? channel.item
    : channel?.item
    ? [channel.item]
    : Array.isArray(channel?.entry)
    ? channel.entry
    : channel?.entry
    ? [channel.entry]
    : []

  const items: NewsItem[] = rawItems.slice(0, 30).map((r: unknown, i) => {
    const raw = r as Record<string, unknown>
    const title =
      (typeof raw.title === "string" ? raw.title : (raw.title as Record<string, unknown>)?.["#text"] as string) ?? ""
    // RSS 2.0 uses <link>, Atom uses <link href="..."> or <id>
    const link =
      (raw.link as string) ??
      (raw.link as Record<string, unknown>)?.["@_href"] as string ??
      (raw.id as string) ?? "#"
    const desc =
      (raw.description as string) ??
      (typeof raw.summary === "string" ? raw.summary : (raw.summary as Record<string, unknown>)?.["#text"] as string) ??
      ""

    // Strip HTML from description for extra field
    const extra = desc.replace(/<[^>]*>/g, "").trim().slice(0, 80) || undefined

    return {
      id: `rss-${i}-${link}`,
      title: title.replace(/<[^>]*>/g, "").trim(),
      url: link,
      extra,
    }
  })

  return { title: feedTitle, items }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TideNow/1.0 RSS Reader (+https://tidenow-web.vercel.app)" },
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const { title, items } = extractItems(xml)

    return NextResponse.json({ title, items, updatedAt: Date.now() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
