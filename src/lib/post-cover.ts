// Shared cover treatment for editorial posts (Phase 3).
// Posts have no cover image yet (frontmatter `cover` is optional and
// currently unused), so the visual identity is a CSS gradient. The
// gradient is picked by hashing the slug, so a post keeps its color
// across rebuilds and reorderings. All classes are full literals so
// Tailwind v4 picks them up during scanning.

export const COVER_GRADIENTS = [
  "from-sky-500 via-indigo-600 to-violet-700",
  "from-rose-500 via-pink-600 to-fuchsia-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-amber-500 via-orange-600 to-red-600",
  "from-blue-600 via-cyan-500 to-teal-500",
  "from-purple-600 via-violet-600 to-indigo-700",
] as const

export function coverGradientFor(slug: string): string {
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length]
}

/** The deep navy → violet brand gradient from the canvas cover cards
 *  (src/lib/cover-card.ts paintBackground), as Tailwind classes, for
 *  the post-page hero. */
export const HERO_GRADIENT = "from-[#0b1026] via-[#1b1440] to-[#3b1d5e]"
