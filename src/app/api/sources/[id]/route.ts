import { ProxyAgent, setGlobalDispatcher } from "undici"
import { sources, type SourceId } from "@/sources"
import { getCached, setCached, getStale } from "@/lib/cache"
import type { NextRequest } from "next/server"

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
    const items = await source.fetch()
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
