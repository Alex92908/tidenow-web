import { ProxyAgent, setGlobalDispatcher } from "undici"
import { sources, type SourceId } from "@/sources"

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) setGlobalDispatcher(new ProxyAgent(proxyUrl))
import { getCached, setCached } from "@/lib/cache"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  // Vercel Cron sends the CRON_SECRET as Authorization header
  const auth = req.headers.get("authorization")
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, string> = {}

  await Promise.allSettled(
    (Object.keys(sources) as SourceId[]).map(async (id) => {
      const source = sources[id]
      const cached = getCached(id, source.meta.interval)
      if (cached) {
        results[id] = "cached"
        return
      }
      try {
        const items = await source.fetch()
        setCached(id, items)
        results[id] = `ok:${items.length}`
      } catch (e) {
        results[id] = `error:${String(e).slice(0, 60)}`
      }
    })
  )

  return Response.json({ results, ts: new Date().toISOString() })
}
