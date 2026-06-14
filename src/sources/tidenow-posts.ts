import type { NewsItem, SourceMeta } from "@/lib/types"
import { getAllPosts } from "@/lib/posts"

export const meta: SourceMeta = {
  id: "tidenow-posts",
  icon: "✍️",
  accentColor: "bg-gradient-to-r from-sky-500 to-cyan-400",
  // Posts are filesystem-backed and only change on deploy, so cache
  // TTL is mostly cosmetic — set it to an hour to match the home-page
  // ISR cadence without pinning the cache to a single build.
  interval: 60 * 60 * 1000,
  defaultCount: 6,
  expandCount: 20,
  column: "global",
}

// TideNow's own editorial posts surfaced as just another source card.
// The user can pin / hide / reorder it like any other card; we don't
// give it any special treatment.
export async function fetch(): Promise<NewsItem[]> {
  const posts = getAllPosts()
  return posts.slice(0, 20).map((p) => ({
    id: `tidenow-post-${p.slug}`,
    title: p.title,
    // Authored-locale URL — a zh post links to /zh/posts/{slug}, an en
    // post to /posts/{slug}. The detail page handles both locales for
    // any slug, but the canonical link should match where the post lives.
    url: p.locale === "zh" ? `/zh/posts/${p.slug}` : `/posts/${p.slug}`,
    extra: p.author ? `${p.author} · ${p.date}` : p.date,
    image: p.cover,
  }))
}
