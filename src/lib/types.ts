export interface NewsItem {
  id: string
  title: string
  url: string
  extra?: string
  mobileUrl?: string
}

export type SourceColumn = "china" | "tech" | "finance" | "global" | "ai"

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
