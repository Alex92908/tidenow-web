export interface CustomFeed {
  id: string      // "rss-{timestamp}"
  url: string
  title: string   // discovered from feed
  icon: string    // emoji, user-picked or default
}

const STORAGE_KEY = "tidenow-custom-feeds"

export function getCustomFeeds(): CustomFeed[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addCustomFeed(feed: CustomFeed) {
  const feeds = getCustomFeeds()
  if (feeds.some((f) => f.url === feed.url)) return // dedupe
  feeds.push(feed)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds))
}

export function removeCustomFeed(id: string) {
  const feeds = getCustomFeeds().filter((f) => f.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds))
}
