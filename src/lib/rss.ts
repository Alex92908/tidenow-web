// Helpers for extracting thumbnails from RSS / Atom <item> or <entry> blocks.
// Different feeds use different conventions; we try them in order of reliability.

const IMG_RE = [
  // <media:thumbnail url="...">
  /<media:thumbnail[^>]*\burl=["']([^"']+)["']/i,
  // <media:content url="..." medium="image" /> or with type="image/..."
  /<media:content[^>]*\burl=["']([^"']+\.(?:jpe?g|png|gif|webp|avif))["']/i,
  /<media:content[^>]*\burl=["']([^"']+)["'][^>]*\b(?:medium=["']image["']|type=["']image\/)/i,
  // <enclosure url="..." type="image/...">
  /<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\//i,
  // <itunes:image href="..."> (rare but happens)
  /<itunes:image[^>]*\bhref=["']([^"']+)["']/i,
  // <image>url</image> (RSS 1.0)
  /<image>([^<]+)<\/image>/i,
  // Atom <content type="html"> (The Verge's feed is Atom, not RSS 2.0)
  /<content[^>]*>(?:<!\[CDATA\[)?[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
  // First <img src="..."> inside <description> CDATA / encoded content
  /<(?:description|content:encoded)[^>]*>(?:<!\[CDATA\[)?[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
]

export function extractImageFromRss(block: string): string | undefined {
  for (const re of IMG_RE) {
    const m = block.match(re)
    if (m?.[1]) return decodeXmlEntities(m[1])
  }
  return undefined
}

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    // Numeric character references: &#8216; / &#x201C; etc.
    // Guarded: an out-of-range code point must not throw and kill the fetch.
    .replace(/&#(\d+);/g, (m: string, code: string) => {
      const n = Number(code)
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (m: string, code: string) => {
      const n = parseInt(code, 16)
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    })
}
