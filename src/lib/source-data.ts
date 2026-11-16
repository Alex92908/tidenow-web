import { sources, type SourceId } from "@/sources"
import { getStale, setCached } from "@/lib/cache"
import type { NewsItem } from "@/lib/types"

// Server-side "get this source's items, or fetch them live if the cache is
// empty". This is the same data path the /api/sources/[id] route uses — the
// registry fetcher (sources[id].fetch()), then setCached() so the next
// render (and the homepage cards on this instance) can reuse it —
// extracted so the /source/[id] page can use it without going through the
// API route. The API route keeps its own inline copy (do not "unify" them
// without touching that route); the sanitize filter is duplicated here for
// the same reason.
//
// Why the page needs this: on Vercel the cache is a per-instance SQLite in
// /tmp, so an instance that has not fetched a source yet serves an empty
// page even though the source is live. The API route never had this
// problem because it fetches on a cache miss; the page only read
// getStale(), so a cold instance rendered "No cached data yet" forever.

export type SourceDataResult = {
  items: NewsItem[]
  /** ms epoch of the data shown, or null when there is no data at all. */
  updatedAt: number | null
  /** true when the items came from the (possibly stale) cache. */
  fromCache: boolean
  /** true when no items could be shown (no cache + live fetch failed). */
  error: boolean
}

/**
 * Drop upstream items with no usable title. Same filter as the API
 * route's sanitize(): a title-less item renders as a blank row and once
 * crashed the homepage when item.title.toLowerCase() was called on it.
 */
export function sanitizeItems(items: unknown): NewsItem[] {
  if (!Array.isArray(items)) return []
  return items.filter(
    (it): it is NewsItem =>
      !!it && typeof it === "object" &&
      typeof (it as NewsItem).title === "string" &&
      (it as NewsItem).title.trim().length > 0
  )
}

// The fetchers have no timeout of their own, so guard the page render
// (and the build, which prerenders every /source page) against a hung
// upstream. 15s is generous for a single RSS/API call.
const FETCH_TIMEOUT_MS = 15_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`fetch timeout after ${ms}ms`)), ms)
    ),
  ])
}

export async function getSourceItems(id: string): Promise<SourceDataResult> {
  // Any cached items — even stale ones — are good enough to render.
  // (Matches the page's previous getStale() behaviour; the page
  // revalidates every 5 min, so stale data is at most that old.)
  const cached = getStale(id)
  if (cached && cached.items.length > 0) {
    return { items: cached.items, updatedAt: cached.updatedAt, fromCache: true, error: false }
  }

  // Cold cache: fetch live, exactly like the API route does.
  const source = sources[id as SourceId]
  if (!source) {
    return { items: [], updatedAt: null, fromCache: false, error: true }
  }
  try {
    const fresh = sanitizeItems(await withTimeout(source.fetch(), FETCH_TIMEOUT_MS))
    if (fresh.length > 0) {
      setCached(id, fresh)
      return { items: fresh, updatedAt: Date.now(), fromCache: false, error: false }
    }
    // An upstream that returns nothing (blocked, rate-limited, frozen
    // feed) is a failure, not a success — same rule as the API route.
    console.warn(`[${id}] live fetch for source page returned 0 items`)
  } catch (e) {
    console.error(`[${id}] live fetch for source page failed:`, e)
  }
  return { items: [], updatedAt: null, fromCache: false, error: true }
}
