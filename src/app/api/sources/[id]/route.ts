import { ProxyAgent, setGlobalDispatcher } from "undici"
import { sources, type SourceId } from "@/sources"
import { getCached, setCached, getStale } from "@/lib/cache"
import type { NextRequest } from "next/server"
import type { NewsItem } from "@/lib/types"

// Server-only: respect system proxy (HTTP_PROXY / HTTPS_PROXY) like Python's trust_env=True
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
}

// Public, browser-friendly JSON API: any origin can consume it (devs building
// their own readers, AI agents fetching context, etc.). The body is already
// cached / rate-limited server-side so loosening CORS doesn't change exposure.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v)
  return res
}

/**
 * 净化上游条目：丢弃没有可用标题的条目。
 *
 * 为什么放在这个统一出口而不是各个适配器里：70 个源中有 30 个直接透传
 * 上游的 title 字段，任何一个上游临时不给这个字段，前端 item.title.toLowerCase()
 * 就会在 useMemo 里抛错、整页白屏——实测腾讯源返回过只有 id/url/image 的条目。
 * 逐个适配器加防御既漏又难维护；所有源都流经这里，在这里堵一次覆盖全部。
 *
 * 只丢没标题的：那种条目对用户本来就没有意义，留着也只是一行空白。
 */
function sanitize(items: unknown): NewsItem[] {
  if (!Array.isArray(items)) return []
  return items.filter(
    (it): it is NewsItem =>
      !!it && typeof it === "object" &&
      typeof (it as NewsItem).title === "string" &&
      (it as NewsItem).title.trim().length > 0
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const source = sources[id as SourceId]

  if (!source) {
    return withCors(Response.json({ error: "Unknown source" }, { status: 404 }))
  }

  const force = req.nextUrl.searchParams.get("force") === "1"
  if (!force) {
    const cached = getCached(id, source.meta.interval)
    if (cached) {
      return withCors(Response.json({ items: cached, updatedAt: Date.now(), cached: true }))
    }
  }

  try {
    const items = sanitize(await source.fetch())
    if (items.length > 0) setCached(id, items)
    return withCors(Response.json({ items, updatedAt: Date.now(), cached: false }))
  } catch (e) {
    const stale = getStale(id)
    if (stale) {
      return withCors(Response.json({ items: stale.items, updatedAt: stale.updatedAt, cached: true, stale: true }))
    }
    console.error(`[${id}] fetch error:`, e)
    // Cold-start with no stale cache + flaky upstream is a frequent serverless
    // edge case. Returning 200 + empty + pending lets the card show a benign
    // "no data yet" state and keeps the route's error rate honest — only real
    // user-visible failures count.
    return withCors(Response.json({ items: [], updatedAt: Date.now(), pending: true }))
  }
}
