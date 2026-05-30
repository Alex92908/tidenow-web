import { SOURCE_IDS, sourceMeta } from "@/sources/metadata"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export const revalidate = 86400 // refresh daily

// llms.txt — emerging convention (https://llmstxt.org/) for sites to give
// LLMs a curated, machine-friendly summary. Served as text/plain.
export function GET() {
  const body = render()
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
}

function render(): string {
  const sourcesByColumn: Record<string, string[]> = {
    china: [],
    tech: [],
    finance: [],
    global: [],
    ai: [],
    entertainment: [],
  }
  for (const id of SOURCE_IDS) {
    const m = sourceMeta[id]
    if (!m || !m.column) continue
    sourcesByColumn[m.column]?.push(id)
  }

  const columnTitles: Record<string, string> = {
    china: "Chinese mainland",
    tech: "Tech & Dev",
    finance: "Finance",
    global: "Global news",
    ai: "AI labs & papers",
    entertainment: "Entertainment & media",
  }

  return `# TideNow

> Real-time aggregator of trending content across 60+ public sources — Hacker News, Reddit, GitHub Trending, Product Hunt, Apple Music, BBC, Reuters, AP, plus Chinese ones like Weibo / Zhihu / Bilibili / 36kr. Each card shows the upstream's current top items; a cross-source "Trending" panel surfaces stories that appear in multiple feeds at once.

Site: ${SITE_URL}
Bilingual: English (default) and 简体中文 (/zh prefix).
License: TideNow is a free, non-commercial personal project. The aggregated content belongs to the upstream publishers; only the page layouts, the cross-source clustering, and the per-source explainer pages are original.

## Key URLs

- ${SITE_URL}/ — homepage, all sources mixed
- ${SITE_URL}/zh — Chinese-first homepage
- ${SITE_URL}/source/{id} — per-source landing page in English (see source list below for ids)
- ${SITE_URL}/zh/source/{id} — Chinese-localized version
- ${SITE_URL}/changelog — release notes
- ${SITE_URL}/sitemap.xml — full sitemap (~120 URLs)

## JSON API

Public, CORS-enabled, no auth required:

- GET ${SITE_URL}/api/sources/{id} — returns \`{ items: [{ id, title, url, extra?, image? }], updatedAt }\`
- ?force=1 query bypasses the server-side cache
- Cache TTL varies per source (5-60 min, see source list)

## Source list

${(Object.keys(sourcesByColumn) as Array<keyof typeof sourcesByColumn>)
  .map((col) => {
    const ids = sourcesByColumn[col]
    if (ids.length === 0) return ""
    return `### ${columnTitles[col] ?? col}\n${ids.map((id) => `- ${id}`).join("\n")}`
  })
  .filter(Boolean)
  .join("\n\n")}

## Project repo

- GitHub: https://github.com/Alex92908/tidenow-web
- Stack: Next.js 16 (App Router), Tailwind v4, better-sqlite3 cache, @dnd-kit/sortable, deployed on Vercel + Cloudflare DNS.

## Contact

- Feedback: alex.chu0206@gmail.com (mailto link in the page footer)
`
}
