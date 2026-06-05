# TideNow

Real-time trending aggregator across 60+ public sources — Hacker News, Reddit, GitHub Trending, Product Hunt, Apple Music, BBC, Reuters, AP, plus Chinese ones like Weibo / Zhihu / Bilibili / 36kr.

Live: **<https://www.tide-now.com>**

- Cross-source "Trending" panel surfaces stories that appear in multiple feeds at once (union-find clustering, English stemmer)
- Per-source detail pages (`/source/{id}`) for every source, indexable
- Editorial **posts** at [`/posts`](https://www.tide-now.com/posts) — weekly-ish takes on cross-source trends, written via the in-site Compose tool and shipped as `.md` files in `src/data/posts/`
- AI-assisted compose tool at [`/compose`](https://www.tide-now.com/compose) — pick 1–5 trending items, choose a style (Feature / Deep dive / Quick read / Listicle / Personal / Custom), generate a draft via your own AI key, edit with split-pane Markdown preview, save locally or export a publish-ready `.md`
- AI summary on hover (bring your own OpenAI / Anthropic / Gemini / DeepSeek key, or use on-device Gemini Nano)
- Drag-to-reorder, pin, hide, keyword mute — all persisted in localStorage, no account needed
- Bilingual (`/` English, `/zh` Chinese)
- No login. No tracking beyond Vercel Analytics.

## Publishing a post

Editorial control = git push access. There is no auth, no DB, no UGC queue — every article that ships at `/posts/{slug}` is a deliberate commit by someone with repo write access.

1. Open [/compose](https://www.tide-now.com/compose), pick trending items, generate / edit a draft.
2. Click **📤 Export for publish** — fills slug / title / description / tags from the body and downloads a complete `.md` file with frontmatter.
3. Drop the file into `src/data/posts/`, `git commit`, `git push`. Vercel auto-deploys; the post lands at `/posts/{slug}` (or `/zh/posts/{slug}`).

Posts are file-system backed (parsed by `src/lib/posts.ts`), included in `sitemap.xml`, and emit Schema.org `Article` JSON-LD per page.

## Public JSON API

Browser-friendly, CORS-enabled, no auth required.

```
GET https://www.tide-now.com/api/sources/{id}
```

Response shape:
```json
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "url": "https://...",
      "extra": "optional secondary line",
      "image": "optional thumbnail URL"
    }
  ],
  "updatedAt": 1716800000000,
  "cached": true
}
```

- `?force=1` bypasses the server-side cache (use sparingly — upstreams rate-limit)
- Cache TTL varies per source (5–60 min); response includes `cached` flag
- Source IDs are listed in [`src/sources/index.ts`](src/sources/index.ts) and the live [`/llms.txt`](https://www.tide-now.com/llms.txt)

Examples:
- `https://www.tide-now.com/api/sources/hackernews`
- `https://www.tide-now.com/api/sources/bbc`
- `https://www.tide-now.com/api/sources/applemusic`

## Stack

- [Next.js 16](https://nextjs.org) — App Router, Turbopack
- [Tailwind CSS v4](https://tailwindcss.com)
- [next-intl](https://next-intl.dev) for en/zh
- [@dnd-kit/sortable](https://dndkit.com) for drag-and-drop
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for the source cache + AI summary memoization (stored in `/tmp` on Vercel)
- Deployed on Vercel, DNS on Cloudflare

## Adding a source

Each source is a single TypeScript file in [`src/sources/`](src/sources/) that exports a `meta` (id, icon, accent color, cache interval) and a `fetch()` returning `NewsItem[]`. The shared [`src/lib/rss.ts`](src/lib/rss.ts) helper extracts thumbnails from RSS/Atom feeds. Register in [`src/sources/index.ts`](src/sources/index.ts) and [`src/sources/metadata.ts`](src/sources/metadata.ts), drop the source name into [`messages/en.json`](messages/en.json) and [`messages/zh.json`](messages/zh.json), done.

## Local dev

```bash
pnpm install
pnpm dev          # http://localhost:3002
```

Env vars (all optional):
- `TMDB_API_KEY` — enables the TMDB Movies / TV cards
- `YOUTUBE_API_KEY` — enables the YouTube Trending card
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` — better Reddit limits
- `HTTPS_PROXY` — server-side fetch will route through the proxy (Node's built-in fetch ignores this by default; we install an undici `ProxyAgent`)

## Changelog

See [`/changelog`](https://www.tide-now.com/changelog) on the live site (data in [`src/data/changelog.ts`](src/data/changelog.ts)).

## License

MIT for the code. Aggregated content belongs to the upstream publishers; TideNow links back to the source for every item.
