import { ProxyAgent, setGlobalDispatcher } from "undici"
import { sources, type SourceId } from "@/sources"
import { getCached, setCached, getStale } from "@/lib/cache"
import type { NextRequest } from "next/server"

// Server-only: respect system proxy (HTTP_PROXY / HTTPS_PROXY) like Python's trust_env=True
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const source = sources[id as SourceId]

  if (!source) {
    return Response.json({ error: "Unknown source" }, { status: 404 })
  }

  const force = req.nextUrl.searchParams.get("force") === "1"
  if (!force) {
    const cached = getCached(id, source.meta.interval)
    if (cached) {
      return Response.json({ items: cached, updatedAt: Date.now(), cached: true })
    }
  }

  try {
    const items = await source.fetch()
    if (items.length > 0) setCached(id, items)
    return Response.json({ items, updatedAt: Date.now(), cached: false })
  } catch (e) {
    const stale = getStale(id)
    if (stale) {
      return Response.json({ items: stale.items, updatedAt: stale.updatedAt, cached: true, stale: true })
    }
    console.error(`[${id}] fetch error:`, e)
    return Response.json({ error: "Fetch failed" }, { status: 500 })
  }
}
