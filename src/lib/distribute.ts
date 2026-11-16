// Multi-platform distribution formatters — pure functions, no browser
// deps, so they can be unit-tested with node (see the Phase 2 test
// script). The compose UI (DistributePanel) calls these for the
// deterministic "Template" output; the "AI" rewrite path calls the same
// /api/compose endpoint the article generator uses and then runs the
// result through the same length enforcers here, so platform limits
// hold regardless of which path produced the text.
//
// Character counting: code points ([...s].length) — a Chinese character
// counts as 1, an emoji counts as 1. That matches the task's rule; it is
// NOT X's weighted count (CJK counts double there), so tweets keep a
// safety margin by targeting ≤ 270 content chars before the " i/n"
// suffix is appended.

export interface DraftSection {
  heading: string
  text: string
}

export interface ParsedDraft {
  title: string
  description: string
  intro: string
  sections: DraftSection[]
  /** All body paragraphs in reading order (intro + sections), plain text. */
  paragraphs: string[]
  locale: "en" | "zh"
  slug: string
  url: string
}

export interface Scene {
  /** On-screen text — short, ≤ 20 chars. */
  onScreen: string
  /** Narration line — 1–2 sentences, TTS-ready. */
  narration: string
  /** What the slide should show, e.g. "title card", "key point 2". */
  visual: string
}

const SITE_URL = "https://www.tide-now.com"

/** Code-point length: CJK = 1, emoji = 1. */
export function cpLen(s: string): number {
  return [...s].length
}

/** Minimal frontmatter reader (title / slug / description only).
 *  Published posts carry their real title in frontmatter; the compose
 *  editor's AI drafts carry it as an H1 instead. */
function parseFrontmatter(md: string): {
  title?: string
  slug?: string
  description?: string
  body: string
} {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { body: md }
  const out: { title?: string; slug?: string; description?: string } = {}
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/i)
    if (!kv) continue
    let val = kv[2].trim()
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1)
    if (kv[1] === "title") out.title = val
    else if (kv[1] === "slug") out.slug = val
    else if (kv[1] === "description") out.description = val
  }
  return { ...out, body: md.slice(m[0].length) }
}

export function stripFrontmatter(md: string): string {
  return parseFrontmatter(md).body
}

/** Light markdown → plain text for counting / display. */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[*_`>#]/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Split text into sentences (EN . ! ? and CJK 。！？). Keeps the
 *  terminator attached to its sentence. */
export function sentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  const parts = clean.match(/[^.!?。！？]+[.!?。！？]+["”’）)]?|[^.!?。！？]+$/g) ?? []
  return parts.map((s) => s.trim()).filter(Boolean)
}

/**
 * Truncate respecting natural breaks (same approach as PublishButton's
 * smartTruncate): prefer a sentence end inside the window, then a word
 * boundary, then a hard cut + ellipsis. CJK runs with no spaces fall
 * through to the hard cut, which is the natural break there.
 *
 * Guaranteed: the result is never longer than `max` code points — every
 * branch checks the length including the trailing "…" before returning,
 * so callers can append a suffix of known length and stay in budget.
 */
export function smartTruncate(s: string, max: number): string {
  const text = s.trim().replace(/\s+/g, " ")
  if (cpLen(text) <= max) return text
  const arr = [...text]
  const windowText = arr.slice(0, max + 1).join("")
  // Look back from `max` for a sentence terminator. `sentenceEnd` is the
  // index of the last terminator in the window; the slice includes it.
  const sentenceEnd = windowText.search(/[.!?。！？][^.!?。！？]*$/)
  if (sentenceEnd > max * 0.5 && sentenceEnd + 1 <= max) {
    return windowText.slice(0, sentenceEnd + 1).trim()
  }
  // Fall back to last word boundary. The "…" costs 1 char.
  const space = windowText.lastIndexOf(" ")
  if (space > max * 0.5) {
    if (space + 1 <= max) return windowText.slice(0, space).trim() + "…"
    return windowText.slice(0, space).trim()
  }
  // No reasonable break — hard cut, reserving 1 char for the ellipsis.
  return arr.slice(0, Math.max(1, max - 1)).join("").trim() + "…"
}

/** Append " suffix" to text, truncating the text first so the whole
 *  result stays within `limit` code points. */
export function withSuffix(text: string, suffix: string, limit: number): string {
  const budget = limit - cpLen(suffix) - 1
  return `${smartTruncate(text, budget)} ${suffix}`
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

/** Strip a leading section number from a heading: "一、决赛之夜" →
 *  "决赛之夜", "1. Introduction" → "Introduction". */
export function stripSectionNumber(h: string): string {
  return h
    .replace(/^(第?[一二三四五六七八九十0-9]+[、．.：:]\s*|第[一二三四五六七八九十0-9]+[部分章]\s*)/, "")
    .trim()
}

export function parseDraft(markdown: string, locale: "en" | "zh"): ParsedDraft {
  const fm = parseFrontmatter(markdown)
  const body = fm.body
  const lines = body.split("\n")
  let h1 = ""
  const sections: DraftSection[] = []
  let current: DraftSection | null = null
  const preH2: string[] = []

  for (const line of lines) {
    const m1 = line.match(/^#\s+(.+)$/)
    if (m1 && !h1) {
      h1 = m1[1].trim()
      continue
    }
    const m2 = line.match(/^##\s+(.+)$/)
    if (m2) {
      current = { heading: m2[1].trim(), text: "" }
      sections.push(current)
      continue
    }
    if (line.trim().startsWith("#")) continue // other headings skipped
    if (current) current.text += line + "\n"
    else preH2.push(line)
  }

  const intro = plainText(preH2.join("\n"))
  const paragraphs: string[] = []
  const pushParas = (text: string) => {
    for (const block of text.split(/\n\s*\n/)) {
      const p = plainText(block)
      if (p) paragraphs.push(p)
    }
  }
  pushParas(preH2.join("\n"))
  for (const s of sections) {
    s.text = plainText(s.text)
    pushParas(s.text)
  }
  // Title priority: frontmatter (published posts) > H1 (editor drafts) >
  // first paragraph. Slug likewise: frontmatter > derived from title.
  const title = fm.title || h1 || (paragraphs[0] ? smartTruncate(paragraphs[0], 60) : "Untitled")
  const description = fm.description || smartTruncate(intro || paragraphs[0] || "", 160)
  const slug = fm.slug || slugify(title) || "untitled"
  const url = `${SITE_URL}${locale === "zh" ? "/zh" : ""}/posts/${slug}`
  return { title, description, intro, sections, paragraphs, locale, slug, url }
}

// ---------------------------------------------------------------------------
// Hashtags
// ---------------------------------------------------------------------------

const EN_STOPWORDS = new Set(
  "the a an and or of to in on for with is are was were be been it its this that these those from by at as but not no so than then when who what how why all more most other over under into about after before between want wants back get gets say says new first over after before year years day today week two three one own".split(" ")
)

/** Split mixed text into tokens: Latin/alphanumeric runs stay whole,
 *  CJK runs stay whole (e.g. "BLG夺得S16全球总冠军" →
 *  ["BLG", "夺得", "S16", "全球总冠军"]). */
function zhTokens(text: string): string[] {
  const out: string[] = []
  const chunks = text.split(/[，。、：；！？·—\-—|：\s"“”‘’《》()（）[\]]+/).filter(Boolean)
  for (const chunk of chunks) {
    const parts = chunk.match(/[A-Za-z0-9]+|[\u2e80-\u9fff]+/g) ?? []
    out.push(...parts)
  }
  return out
}

const ZH_VERB_STOPWORDS = new Set([
  "夺得", "击败", "获得", "成为", "宣布", "表示", "认为", "取得", "拿下", "赢得", "举行", "进行",
])

/** 2–3 topic tags derived from the title + section headings. Returns
 *  plain words (no #) — each platform formats them its own way. */
export function extractHashtags(draft: ParsedDraft): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (w: string) => {
    const word = w.trim()
    if (!word || seen.has(word.toLowerCase())) return
    seen.add(word.toLowerCase())
    out.push(word)
  }
  if (draft.locale === "zh") {
    const haystack = [draft.title, ...draft.sections.map((s) => stripSectionNumber(s.heading))]
    for (const text of haystack) {
      for (const tok of zhTokens(text)) {
        if (/^[A-Za-z0-9]+$/.test(tok)) {
          if (tok.length >= 2 && !/^\d+$/.test(tok)) push(tok)
        } else if (cpLen(tok) >= 2 && cpLen(tok) <= 6 && !ZH_VERB_STOPWORDS.has(tok)) {
          push(tok)
        }
        if (out.length >= 3) break
      }
      if (out.length >= 3) break
    }
  } else {
    // The topic usually sits after the colon ("Ousted, sued — …: the
    // Nvidia paradox" → Nvidia first), so read that part before the rest.
    const colon = draft.title.lastIndexOf(":")
    const ordered =
      colon >= 0
        ? `${draft.title.slice(colon + 1)} ${draft.title.slice(0, colon)}`
        : draft.title
    const words = `${ordered} ${draft.sections.map((s) => stripSectionNumber(s.heading)).join(" ")}`
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .map((w) => w.trim())
      .filter((w) => /^[A-Za-z]{3,}$/.test(w) && !EN_STOPWORDS.has(w.toLowerCase()))
    for (const w of words) push(w.charAt(0).toUpperCase() + w.slice(1))
  }
  if (out.length === 0) push(draft.locale === "zh" ? "热点" : "Trending")
  return out.slice(0, 3)
}

// ---------------------------------------------------------------------------
// X / Twitter thread
// ---------------------------------------------------------------------------

export interface ThreadResult {
  tweets: string[]
  /** Number of hashtags used on the last tweet. */
  hashtags: string[]
}

/** Split the draft into a numbered thread. Tweet 1 is the hook, middle
 *  tweets are one key point each, the last tweet carries hashtags + link.
 *  Every tweet is ≤ 280 chars including its " i/n" suffix. */
export function formatX(draft: ParsedDraft): ThreadResult {
  const tags = extractHashtags(draft)
  const hashtags = tags.map((t) => `#${t.replace(/\s+/g, "")}`)
  const linkLine =
    draft.locale === "zh" ? `全文：${draft.url}` : `Full story: ${draft.url}`

  // Key points: one per H2 section (heading + first sentence). Fall back
  // to intro sentences when the draft has no sections.
  const points: string[] = []
  for (const sec of draft.sections) {
    const first = sentences(sec.text)[0] ?? ""
    const heading = stripSectionNumber(sec.heading)
    const point = first ? `${heading}：${first}` : heading
    points.push(point)
    if (points.length >= 5) break
  }
  if (points.length === 0) {
    for (const s of sentences(draft.intro).slice(0, 3)) points.push(s)
  }
  if (points.length === 0 && draft.paragraphs.length > 0) {
    for (const p of draft.paragraphs.slice(0, 3)) {
      const s = sentences(p)[0]
      if (s) points.push(s)
    }
  }

  const hook = smartTruncate(draft.intro || draft.title, 200)
  const raw: string[] = []
  raw.push(hook || draft.title)
  raw.push(...points)
  raw.push(`${hashtags.join(" ")}\n${linkLine}`)

  const n = raw.length
  const tweets = raw.map((t, i) => withSuffix(t, `${i + 1}/${n}`, 280))
  return { tweets, hashtags }
}

// ---------------------------------------------------------------------------
// Weibo
// ---------------------------------------------------------------------------

export interface WeiboResult {
  posts: string[]
}

/** Weibo: punchy single post, ≤ 140 chars. If the hook + hashtags don't
 *  fit, the body spills into numbered continuation posts, each ≤ 140. */
export function formatWeibo(draft: ParsedDraft): WeiboResult {
  const tags = extractHashtags(draft)
  const hashtags = tags.map((t) => `#${t.replace(/\s+/g, "")}#`).join("")
  const hook = sentences(draft.intro)[0] || draft.title
  const stat = sentences(draft.intro)[1] || ""

  // Candidate sentences in reading order: hook, stat, then one sentence
  // per section (first sentence only).
  const bodySentences: string[] = [hook]
  if (stat) bodySentences.push(stat)
  for (const sec of draft.sections.slice(0, 3)) {
    const s = sentences(sec.text)[0]
    if (s) bodySentences.push(s)
  }

  // Greedily pack sentences into ≤ 140-char posts. Hashtags ride on the
  // last post. Numbering "(i/n)" is added only when there's > 1 post.
  const pack = (items: string[], tagTail: string): string[] => {
    const posts: string[] = []
    let cur = ""
    const flush = () => {
      if (cur) posts.push(cur)
      cur = ""
    }
    for (const item of items) {
      const piece = item.trim()
      if (!piece) continue
      const joined = cur ? `${cur} ${piece}` : piece
      if (cpLen(joined) <= 132) {
        cur = joined
      } else {
        flush()
        // A single sentence longer than the budget gets truncated.
        cur = cpLen(piece) <= 132 ? piece : smartTruncate(piece, 132)
      }
    }
    flush()
    if (posts.length === 0) posts.push(smartTruncate(draft.title, 132))
    // Append hashtags to the last post if they fit, else their own post.
    const last = posts[posts.length - 1]
    if (tagTail && cpLen(last) + 1 + cpLen(tagTail) <= 140) {
      posts[posts.length - 1] = `${last} ${tagTail}`
    } else if (tagTail) {
      posts.push(tagTail)
    }
    return posts
  }

  const packed = pack(bodySentences, hashtags)
  if (packed.length === 1) return { posts: packed }
  return {
    posts: packed.map((p, i) => withSuffix(p, `(${i + 1}/${packed.length})`, 140)),
  }
}

// ---------------------------------------------------------------------------
// Zhihu (long-form Markdown)
// ---------------------------------------------------------------------------

/** Zhihu: title + intro + up to 3 key points under ### + conclusion,
 *  as Markdown the user can paste into a Zhihu article/answer. */
export function formatZhihu(draft: ParsedDraft): string {
  const isZh = draft.locale === "zh"
  const points = draft.sections.slice(0, 3)
  const lines: string[] = []
  lines.push(`# ${draft.title}`)
  lines.push("")
  if (draft.intro) lines.push(draft.intro, "")
  if (points.length === 0) {
    // No sections: use the first 3 paragraphs as the body.
    for (const p of draft.paragraphs.slice(0, 3)) lines.push(p, "")
  } else {
    for (const sec of points) {
      lines.push(`### ${stripSectionNumber(sec.heading)}`, "")
      const sents = sentences(sec.text)
      lines.push(sents.slice(0, 3).join(" ") || sec.text, "")
    }
  }
  const closing =
    draft.paragraphs[draft.paragraphs.length - 1] ?? ""
  const conclusion = isZh
    ? `**结语**\n\n${closing}`
    : `**Bottom line**\n\n${closing}`
  lines.push(conclusion, "")
  lines.push("---", "")
  lines.push(
    isZh
      ? `*原文首发于 TideNow：${draft.url}*`
      : `*Originally published on TideNow: ${draft.url}*`
  )
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// 小红书 (Xiaohongshu)
// ---------------------------------------------------------------------------

export interface XiaohongshuResult {
  title: string
  body: string
}

/** 小红书： catchy title ≤ 20 chars (with emoji) + short body: short
 *  paragraphs, emoji bullets, 3–5 #tags at the end. */
export function formatXiaohongshu(draft: ParsedDraft): XiaohongshuResult {
  const isZh = draft.locale === "zh"
  const emoji = isZh ? "🔥" : "✨"
  // First clause of the title is usually the punchiest part.
  const firstClause = draft.title.split(/[，。、：；！？|｜\-—]/)[0].trim() || draft.title
  const titleText = smartTruncate(firstClause, 19 - cpLen(emoji)).replace(/…$/, "")
  const title = `${emoji}${titleText}`

  const tags = extractHashtags(draft)
  const tagLine = tags.map((t) => `#${t.replace(/\s+/g, "")}`).join(" ")
  const extraTag = isZh ? "#热点" : "#TideNow"
  const allTags = tagLine.includes(extraTag) ? tagLine : `${tagLine} ${extraTag}`

  const bullets: string[] = []
  const icons = ["📌", "💡", "👀"]
  const points = draft.sections.slice(0, 3)
  if (points.length > 0) {
    points.forEach((sec, i) => {
      const s = sentences(sec.text)[0] ?? sec.text
      bullets.push(`${icons[i % icons.length]} ${smartTruncate(`${stripSectionNumber(sec.heading)}：${s}`, 60)}`)
    })
  } else {
    sentences(draft.intro)
      .slice(0, 3)
      .forEach((s, i) => bullets.push(`${icons[i % icons.length]} ${smartTruncate(s, 60)}`))
  }

  const hook = sentences(draft.intro)[0] || draft.description
  const closing = isZh ? "完整分析见 TideNow 👇" : "Full take on TideNow 👇"
  const body = [
    smartTruncate(hook, 120),
    "",
    ...bullets,
    "",
    `${closing} ${draft.url}`,
    "",
    allTags,
  ].join("\n")
  return { title, body }
}

// ---------------------------------------------------------------------------
// Video: storyboard + SRT
// ---------------------------------------------------------------------------

/** Build 5–7 scenes from the draft: title card + 3–5 content scenes +
 *  end card. Content scenes come from H2 sections; when a draft has
 *  fewer than 3 sections, intro paragraphs are split into extra scenes
 *  so the video never drops below 5 scenes. */
export function buildScenes(draft: ParsedDraft): Scene[] {
  const isZh = draft.locale === "zh"
  const shortTitle = (s: string): string => {
    const clean = stripSectionNumber(s)
    const clause = clean.split(/[，。、：；！？|｜\-—]/)[0].trim() || clean
    return smartTruncate(clause, 20).replace(/…$/, "")
  }

  const introSents = sentences(draft.intro)
  const titleScene: Scene = {
    onScreen: shortTitle(draft.title),
    narration: introSents.slice(0, 2).join(" ") || draft.description,
    visual: "title card",
  }

  const content: Scene[] = []
  for (const sec of draft.sections.slice(0, 5)) {
    const sents = sentences(sec.text)
    content.push({
      onScreen: shortTitle(sec.heading),
      narration: sents.slice(0, 2).join(" ") || sec.text,
      visual: `key point ${content.length + 1}`,
    })
  }
  // Pad to ≥ 3 content scenes from intro / body paragraphs when the
  // draft is thin on H2 sections.
  if (content.length < 3) {
    const pool = [
      ...introSents.slice(2),
      ...draft.paragraphs.slice(1).flatMap((p) => sentences(p)),
    ].filter(Boolean)
    let i = 0
    while (content.length < 3 && i < pool.length) {
      const chunk = pool.slice(i, i + 2).join(" ")
      content.push({
        onScreen: shortTitle(pool[i]),
        narration: chunk,
        visual: `key point ${content.length + 1}`,
      })
      i += 2
    }
  }

  const endScene: Scene = {
    onScreen: isZh ? "全文见 TideNow" : "More on TideNow",
    narration: isZh
      ? `完整分析在 TideNow：${draft.url}`
      : `Read the full story on TideNow: ${draft.url}`,
    visual: "end card",
  }

  return [titleScene, ...content.slice(0, 5), endScene]
}

/** Per-scene on-screen duration, from the narration length: ~150
 *  words/min for EN (~2.5 words/s), ~300 chars/min for ZH (5 chars/s),
 *  with a 3s floor so no slide flashes past. Rounded up to 0.5s. */
export function sceneDurationSec(scene: Scene, locale: "en" | "zh"): number {
  const units =
    locale === "zh"
      ? cpLen(scene.narration)
      : scene.narration.split(/\s+/).filter(Boolean).length
  const rate = locale === "zh" ? 5 : 2.5
  return Math.max(3, Math.ceil((units / rate) * 2) / 2)
}

export function totalDurationSec(scenes: Scene[], locale: "en" | "zh"): number {
  return scenes.reduce((sum, s) => sum + sceneDurationSec(s, locale), 0)
}

function srtTimestamp(totalSec: number): string {
  const ms = Math.round(totalSec * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const rem = ms % 1000
  const pad = (n: number, w: number) => String(n).padStart(w, "0")
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(rem, 3)}`
}

/** .srt subtitles for the narration, one cue per scene. */
export function buildSrt(scenes: Scene[], locale: "en" | "zh"): string {
  let t = 0
  const cues = scenes.map((scene, i) => {
    const dur = sceneDurationSec(scene, locale)
    const cue = [
      `${i + 1}`,
      `${srtTimestamp(t)} --> ${srtTimestamp(t + dur)}`,
      scene.narration,
      "",
    ].join("\n")
    t += dur
    return cue
  })
  return cues.join("\n")
}

/** Full voiceover script: narration lines joined with blank lines. */
export function buildNarrationScript(scenes: Scene[]): string {
  return scenes.map((s, i) => `【${i + 1}】 ${s.narration}`).join("\n\n")
}
