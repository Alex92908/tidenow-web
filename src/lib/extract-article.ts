import * as cheerio from "cheerio"
import { myFetch } from "@/lib/fetch"

// Lightweight readability-style body extractor. Given an article URL it
// fetches the HTML and pulls the main text, so the Compose writer gets
// real facts instead of inventing them from a bare headline. Built on
// cheerio (already a dep) — no jsdom, no @mozilla/readability weight.
//
// Realistic expectations: this works for server-rendered news/blogs
// (Reuters, BBC, 36kr, Zhihu answers, most HN link targets). It returns
// empty for JS-rendered SPAs (Weibo/Douyin search pages, some apps) —
// the caller degrades to title-only for those.

const MAX_CHARS = 1200
const FETCH_TIMEOUT_MS = 5000

export interface ExtractedArticle {
  /** Cleaned main-body text, capped at MAX_CHARS. Empty if extraction
   *  found nothing usable. */
  text: string
  /** og:description / meta description — a useful one-liner even when
   *  the body extraction fails. */
  summary: string
}

export async function extractArticle(url: string): Promise<ExtractedArticle> {
  const empty: ExtractedArticle = { text: "", summary: "" }
  // Only attempt http(s) URLs. Internal /posts links etc. have no
  // external body to fetch.
  if (!/^https?:\/\//i.test(url)) return empty

  let html: string
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await myFetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return empty
    const ct = res.headers.get("content-type") ?? ""
    if (!ct.includes("html")) return empty
    html = await res.text()
  } catch {
    // timeout / network / abort — degrade to title-only upstream
    return empty
  }

  let $: ReturnType<typeof cheerio.load>
  try {
    $ = cheerio.load(html)
  } catch {
    return empty
  }

  // Meta summary first — cheap and reliable even when body extraction is
  // messy. Prefer og:description, fall back to name=description.
  const summary =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    ""

  // Strip the obvious non-content nodes before we look for body text.
  $("script, style, noscript, nav, header, footer, aside, form, iframe").remove()

  // Collect all <p> text within a CSS-selected scope. Skips short
  // boilerplate lines (cookie notices, share prompts).
  const collect = (selector: string): string => {
    const parts: string[] = []
    $(selector).find("p").each((_i, p) => {
      const t = $(p).text().replace(/\s+/g, " ").trim()
      if (t.length >= 40) parts.push(t)
    })
    return parts.join("\n").trim()
  }

  // Heuristic: prefer a semantic <article>; otherwise scan candidate
  // containers for the densest paragraph cluster. Poor man's readability
  // main-content finder — good enough to give the writer real sentences.
  let bodyText = collect("article")
  if (bodyText.length < 200) {
    for (const sel of ["main", "[role=main]", ".content", ".article", ".post", "#content", "body"]) {
      const t = collect(sel)
      if (t.length > bodyText.length) bodyText = t
    }
  }

  const text = bodyText.slice(0, MAX_CHARS).trim()
  return { text, summary }
}

/**
 * Extract several articles in parallel with a hard ceiling on how many we
 * bother fetching (the lead items matter most and each fetch costs
 * latency). Order is preserved; failed extractions come back as empty.
 */
export async function extractArticles(
  urls: string[],
  limit = 3
): Promise<ExtractedArticle[]> {
  const targets = urls.slice(0, limit)
  const rest = urls.slice(limit).map(() => ({ text: "", summary: "" }))
  const extracted = await Promise.all(targets.map((u) => extractArticle(u)))
  return [...extracted, ...rest]
}
