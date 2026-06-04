import fs from "node:fs"
import path from "node:path"

// File-system backed "CMS". Articles live as markdown files with YAML-ish
// frontmatter in src/data/posts/. Editorial control = git push access.
// No DB, no auth, no UGC queue — everything that ships is a deliberate
// commit by someone with repo access (see docs/2026-05-31-session-notes.md).

const POSTS_DIR = path.join(process.cwd(), "src", "data", "posts")

export interface Post {
  slug: string
  title: string
  description: string
  date: string // ISO yyyy-mm-dd
  /** Display author. No identity verification — frontmatter is editorial. */
  author?: string
  /** Which locale this post is written in. Lists are filtered by this so
   *  /posts shows EN posts and /zh/posts shows ZH posts. */
  locale: "en" | "zh"
  tags?: string[]
  /** Optional cover/OG image URL (absolute or rooted at /). */
  cover?: string
  body: string
}

/**
 * Minimal frontmatter parser. We hand-roll instead of pulling gray-matter
 * because (a) zero extra deps for a 30-line problem, (b) we control the
 * format — posts ship from our own Compose tool with a fixed schema.
 *
 * Supports:
 *   key: value         → string
 *   key: [a, b, c]     → string[]  (no nested arrays)
 *   key: "quoted"      → unquoted
 *   key: true/false    → boolean (not used today, future-proof)
 */
function parseFrontmatter(raw: string): {
  meta: Record<string, string | string[] | boolean>
  body: string
} {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw }
  const meta: Record<string, string | string[] | boolean> = {}
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/i)
    if (!kv) continue
    const key = kv[1].trim()
    let val: string | string[] | boolean = kv[2].trim()
    // Strip surrounding quotes
    if (typeof val === "string" && /^["'].*["']$/.test(val)) {
      val = val.slice(1, -1)
    }
    // Array form: [a, b, c]
    if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    }
    if (val === "true") val = true
    else if (val === "false") val = false
    meta[key] = val
  }
  return { meta, body: m[2] }
}

function readOnePost(filename: string): Post | null {
  if (!filename.endsWith(".md") || filename.startsWith(".")) return null
  let raw: string
  try {
    raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8")
  } catch {
    return null
  }
  const { meta, body } = parseFrontmatter(raw)

  // Required fields. If a post is malformed (missing slug or title), skip
  // it rather than crash the route — bad posts shouldn't take down /posts.
  const slug = typeof meta.slug === "string" ? meta.slug : filename.replace(/\.md$/, "")
  const title = typeof meta.title === "string" ? meta.title : ""
  const date = typeof meta.date === "string" ? meta.date : "1970-01-01"
  const locale: "en" | "zh" = meta.locale === "zh" ? "zh" : "en"
  if (!title) return null

  return {
    slug,
    title,
    description: typeof meta.description === "string" ? meta.description : "",
    date,
    author: typeof meta.author === "string" ? meta.author : undefined,
    locale,
    tags: Array.isArray(meta.tags) ? meta.tags : undefined,
    cover: typeof meta.cover === "string" ? meta.cover : undefined,
    body: body.trim(),
  }
}

/** All posts across both locales, sorted newest-first. Cached per-process. */
let _all: Post[] | null = null
export function getAllPosts(): Post[] {
  if (_all) return _all
  let files: string[]
  try {
    files = fs.readdirSync(POSTS_DIR)
  } catch {
    files = [] // posts dir might not exist on a fresh clone
  }
  _all = files
    .map(readOnePost)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
  return _all
}

export function getPostsByLocale(locale: "en" | "zh"): Post[] {
  return getAllPosts().filter((p) => p.locale === locale)
}

export function getPostBySlug(slug: string): Post | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug)
}
