export interface NewsItem {
  id: string
  title: string
  url: string
  extra?: string
  mobileUrl?: string
  /** Optional thumbnail URL extracted from the upstream source (poster /
   *  cover art / media:thumbnail / og:image). Renders as a small image
   *  next to the title in SourceCard when present. */
  image?: string
}

export type SourceColumn = "china" | "tech" | "finance" | "global" | "ai" | "entertainment"

// Active filter for the top tab bar: "all" / "favorites" (user-pinned) /
// "hidden" (user-hidden sources) / a specific category column.
export type FilterId = SourceColumn | "all" | "favorites" | "hidden"

export interface SourceMeta {
  id: string
  icon: string
  accentColor: string  // tailwind gradient or solid class for the top accent bar
  interval: number     // cache TTL in ms
  defaultCount: number
  expandCount: number
  column?: SourceColumn
}

export interface CachedSource {
  id: string
  items: NewsItem[]
  updatedAt: number
}
