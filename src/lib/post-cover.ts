// Shared cover treatment for editorial posts (Phase 3, palette revised
// twice on lee's feedback 2026-11-15: bright saturated gradients were
// "太恶心了", then the dark ink replacement was "不要深色背景").
// Posts have no cover image yet (frontmatter `cover` is optional and
// currently unused), so the visual identity is a CSS gradient. The
// gradient is picked by hashing the slug, so a post keeps its color
// across rebuilds and reorderings. All classes are full literals so
// Tailwind v4 picks them up during scanning.
//
// Palette rule (current): EVERY variant is a PALE, desaturated tint —
// near-white, calm, editorial. No saturated colors and no dark
// backgrounds. Titles and pills on top use dark ink text.

export const COVER_GRADIENTS = [
  "from-[#f6f1e8] to-[#efe9dc]",
  "from-[#eef1f4] to-[#e3e8ec]",
  "from-[#e9f0ec] to-[#dde7e0]",
  "from-[#f3ecef] to-[#eadfe3]",
  "from-[#eceef5] to-[#dfe2ec]",
  "from-[#f0ece6] to-[#e6e0d3]",
] as const

export function coverGradientFor(slug: string): string {
  let h = 0
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length]
}

/** The post-page hero background. Pale and light (lee: no dark
 *  backgrounds), matching the card covers. Dark ink text sits on top. */
export const HERO_GRADIENT = "from-[#f7f5f0] to-[#e9ebee]"
