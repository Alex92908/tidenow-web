// Shared cover treatment for editorial posts (Phase 3, palette revised
// 2026-11-15 after lee called the bright gradients "太恶心了").
// Posts have no cover image yet (frontmatter `cover` is optional and
// currently unused), so the visual identity is a CSS gradient. The
// gradient is picked by hashing the slug, so a post keeps its color
// across rebuilds and reorderings. All classes are full literals so
// Tailwind v4 picks them up during scanning.
//
// Palette rule: EVERY variant is a deep, desaturated ink tone fading to
// near-black. No saturated candy colors — the cover should read as a
// calm dark field with white type on top, in the site's navy brand
// language. Variety comes from the hue family, not from brightness.

export const COVER_GRADIENTS = [
  "from-[#1a2233] to-[#0a0e1a]",
  "from-[#1e1a2e] to-[#0d0a18]",
  "from-[#12291f] to-[#081310]",
  "from-[#2b1d12] to-[#140d06]",
  "from-[#241521] to-[#120a10]",
  "from-[#0f2b33] to-[#071417]",
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
