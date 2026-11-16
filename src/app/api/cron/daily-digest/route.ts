// Daily digest cron — GET /api/cron/daily-digest
//
// Every day at 00:00 UTC (08:00 Beijing) Vercel Cron hits this route.
// It takes the day's trending topics from the site's own sources, has AI
// write a hot-topics roundup in EN + ZH, and commits both .md files to
// the repo via the GitHub Contents API. Vercel auto-deploys on push, so
// the posts go live within minutes. No human clicks anything.
//
// Env vars (set in the Vercel dashboard; see DAILY-DIGEST.md):
//   CRON_SECRET          — REQUIRED. Any random string. Vercel Cron sends
//                          it as `Authorization: Bearer <secret>` when it
//                          is set. The route REFUSES to run without it.
//   DIGEST_AI_PROVIDER   — deepseek (default, cheapest) | openai |
//                          anthropic | zhipu | gemini
//   DIGEST_AI_KEY        — the provider API key (server-side only).
//   DIGEST_GITHUB_TOKEN  — fine-grained token, Contents read+write on
//                          Alex92908/tidenow-web. Same kind of token as
//                          the /compose one-click publish uses.
//   DIGEST_STUB_AI=1     — test hook: skip the AI call and use a canned
//                          body built from the real topics (never set in
//                          production). `?stub=1` does the same for one
//                          manual run. Both still require the secret.
//
// Modes:
//   ?dry=1   — run everything EXCEPT the GitHub PUTs; returns both
//              generated .md files in the response for inspection.
//   ?stub=1  — use the canned body instead of calling the AI.
//
// Safety:
//   - Idempotent: if either of today's files already exists in the repo,
//     the route returns {skipped:"already-published"} and does NOT
//     generate or overwrite anything.
//   - If fewer than 3 usable topics exist per locale, it publishes
//     NOTHING (a thin digest is worse than skipping a day).
//   - Secrets are never logged and never echoed in any response.
import { ProxyAgent, setGlobalDispatcher } from "undici"

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) setGlobalDispatcher(new ProxyAgent(proxyUrl))

import { sources, type SourceId } from "@/sources"
import { getCached, setCached } from "@/lib/cache"
import { aggregateTrending, type TrendingTopic } from "@/lib/aggregate"
import { callAI, isDigestProvider } from "@/lib/ai-call"
import type { AIProvider } from "@/lib/ai-settings"
import type { NewsItem } from "@/lib/types"
import enMessages from "../../../../../messages/en.json"
import zhMessages from "../../../../../messages/zh.json"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const REPO = "Alex92908/tidenow-web"
const GH_API = `https://api.github.com/repos/${REPO}/contents`
const AUTHOR = "TideNow"

type DigestLocale = "en" | "zh"

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10) // yyyy-mm-dd, UTC
}

function slugFor(date: string, locale: DigestLocale): string {
  return locale === "zh" ? `daily-${date}-zh` : `daily-${date}`
}

// ─── GitHub Contents API ────────────────────────────────────────────

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

/** Returns the file's sha when it exists, null on 404. Throws otherwise. */
async function githubGetSha(path: string, token?: string): Promise<string | null> {
  const res = await fetch(`${GH_API}/${path}`, { headers: ghHeaders(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET ${path} → HTTP ${res.status}`)
  const d = (await res.json()) as { sha?: string }
  return d.sha ?? null
}

async function githubPutFile(
  path: string,
  content: string,
  message: string,
  token: string
): Promise<{ sha: string; url: string }> {
  const res = await fetch(`${GH_API}/${path}`, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
    }),
  })
  if (res.status === 401) throw new Error("GitHub 401: DIGEST_GITHUB_TOKEN is invalid or expired")
  if (res.status === 403)
    throw new Error("GitHub 403: token lacks Contents read+write on Alex92908/tidenow-web (or rate-limited)")
  if (!res.ok) throw new Error(`GitHub PUT ${path} → HTTP ${res.status}`)
  const d = (await res.json()) as { commit?: { sha?: string }; content?: { html_url?: string } }
  return { sha: d.commit?.sha ?? "", url: d.content?.html_url ?? "" }
}

// ─── Topic selection ────────────────────────────────────────────────

const sourceNamesEn = (enMessages as { sources?: Record<string, string> }).sources ?? {}
const sourceNamesZh = (zhMessages as { sources?: Record<string, string> }).sources ?? {}

function sourceName(id: string, locale: DigestLocale): string {
  const map = locale === "zh" ? sourceNamesZh : sourceNamesEn
  return map[id] ?? id
}

interface TopicMaterial {
  title: string
  sources: string[]
  extra?: string
  url: string
  altTitles: string[]
}

function toMaterial(topic: TrendingTopic, locale: DigestLocale): TopicMaterial {
  const best = topic.mentions.reduce((a, b) => (a.rank <= b.rank ? a : b))
  const names: string[] = []
  for (const m of topic.mentions) {
    const n = sourceName(m.sourceId, locale)
    if (!names.includes(n)) names.push(n)
    if (names.length >= 4) break
  }
  const altTitles: string[] = []
  for (const m of topic.mentions) {
    if (m.item.title !== topic.displayTitle && !altTitles.includes(m.item.title)) {
      altTitles.push(m.item.title.slice(0, 120))
    }
    if (altTitles.length >= 2) break
  }
  return {
    title: topic.displayTitle,
    sources: names,
    extra: best.item.extra?.slice(0, 200),
    url: best.item.url,
    altTitles,
  }
}

async function fetchTopics(): Promise<{ en: TopicMaterial[]; zh: TopicMaterial[] }> {
  const ids = Object.keys(sources) as SourceId[]
  const sourceData: Record<string, { items: NewsItem[] }> = {}
  // Bound the whole phase: a hung upstream must not stall the digest.
  // The warm cron has no per-source timeout and can run past 60s; the
  // digest has a 60s budget total (fetch + 2 AI calls + 2 GitHub PUTs),
  // so each source gets 12s and the phase resolves in ~12s worst case.
  // A timed-out source just drops out of today's digest.
  const FETCH_TIMEOUT_MS = 12_000
  const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("fetch timeout")), FETCH_TIMEOUT_MS)
      ),
    ])
  await Promise.allSettled(
    ids.map(async (id) => {
      const source = sources[id]
      try {
        const cached = getCached(id, source.meta.interval)
        if (cached && cached.length > 0) {
          sourceData[id] = { items: cached }
          return
        }
        const items = await withTimeout(source.fetch())
        if (items.length > 0) {
          setCached(id, items)
          sourceData[id] = { items }
        }
      } catch {
        // A dead or hung source just drops out of today's digest — the
        // warm cron reports it separately; the digest must not fail
        // over one feed.
      }
    })
  )
  const topics = aggregateTrending(sourceData, 2, 8)
  const en = topics.filter((t) => t.lang === "en").slice(0, 6).map((t) => toMaterial(t, "en"))
  const zh = topics.filter((t) => t.lang === "zh").slice(0, 6).map((t) => toMaterial(t, "zh"))
  return { en, zh }
}

// ─── AI writing ─────────────────────────────────────────────────────

const MAX_TOKENS = 2000

function systemPrompt(locale: DigestLocale): string {
  if (locale === "zh") {
    return `你是一个给 TideNow 写每日热点日报的编辑。TideNow 是一个聚合全网热榜的网站。全文使用简体中文。

硬性要求：
- 只能用下面给出的素材里的事实。绝不编造素材里没有的日期、数字、引述、人名或事件。
- 每个故事都要点名是哪些媒体/平台在报道。
- 像人写的日报一样写，不要像 AI 在汇报；不要写"根据热榜"这类话。
- 不要写一级标题 #（页面会单独渲染标题），直接从导语段落开始。
- 不要用"总之""让我们拭目以待"这类套话收尾。`
  }
  return `You are an editor writing a daily hot-topics roundup for TideNow, a trending-news aggregator. Write in English only.

Hard rules:
- Use ONLY the facts in the topics below. Never invent dates, numbers, quotes, names, or events that aren't in the material.
- Name the outlets covering each story.
- Write like a human editor, not an AI report. Don't say "according to trending lists".
- Do NOT include an H1 title — the page renders the title separately. Start with the intro paragraph.
- No filler closing ("In conclusion", "Time will tell").`
}

function userPrompt(materials: TopicMaterial[], locale: DigestLocale): string {
  const lines = materials.map((m, i) => {
    const parts = [`${i + 1}. [${m.sources.join(", ")}] ${m.title}`]
    if (m.extra) parts.push(`   ${locale === "zh" ? "摘要" : "Snippet"}: ${m.extra}`)
    for (const alt of m.altTitles) parts.push(`   ${locale === "zh" ? "另见" : "Also"}: "${alt}"`)
    parts.push(`   url: ${m.url}`)
    return parts.join("\n")
  })
  if (locale === "zh") {
    return `请用下面 ${materials.length} 条今日热点写今天的日报：\n\n${lines.join("\n\n")}\n\n结构：\n- 开头一段导语（2-3 句），概括今天的大势。\n- 每个故事一个 ## 小节，标题是内容相关的短语；2-3 句讲清发生了什么，并点名哪些媒体/平台在报道。\n- 结尾一个 ## 为什么重要 小节（2-3 句），说说今天这些热点的共同指向。\n全文 1000-1500 字。\n\n最后单独一行写：\nTAGS: 标签1, 标签2, 标签3\n（最多 4 个简短标签，中文）`
  }
  return `Write today's daily digest from these ${materials.length} trending topics:\n\n${lines.join("\n\n")}\n\nStructure:\n- A short intro paragraph (2-3 sentences) framing the day.\n- One ## section per story, with a headline-style heading. 2-3 sentences each: what happened, plus which outlets covered it.\n- A closing ## Why it matters section (2-3 sentences) with your take on the day's pattern.\nTotal 600-1000 words.\n\nEnd your response with exactly one line:\nTAGS: tag1, tag2, tag3\n(max 4 short tags, lowercase, in English)`
}

/** Canned body for testing (DIGEST_STUB_AI=1 or ?stub=1). Built from the
 *  real topics so topic selection + frontmatter are genuinely exercised;
 *  only the prose is fake, and it is marked [STUB] throughout. */
function stubBody(materials: TopicMaterial[], locale: DigestLocale): string {
  const sections = materials.map(
    (m) =>
      `## ${m.title}\n\n${m.title} — ${locale === "zh" ? "报道方" : "covered by"}: ${m.sources.join("、")}. [STUB]`
  )
  const body =
    locale === "zh"
      ? `今天的日报覆盖 ${materials.length} 条热点。[STUB —— 测试用的固定文案，不是 AI 写的。]\n\n${sections.join("\n\n")}\n\n## 为什么重要\n\n[STUB] 这些热点就是今天大家注意力集中的地方。\n\nTAGS: daily-digest`
      : `Today's digest covers ${materials.length} stories making the rounds across the sources TideNow tracks. [STUB — canned test body, not AI-written.]\n\n${sections.join("\n\n")}\n\n## Why it matters\n\n[STUB] These stories show where the day's attention clustered.\n\nTAGS: daily-digest`
  return body
}

// ─── Frontmatter + body assembly ────────────────────────────────────

function quote(s: string): string {
  if (/[:#\[\]{}"',|>&*!%@`]|^-/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  return s
}

/** Truncate at a sentence end or word boundary, never mid-word. */
function smartTruncate(s: string, max: number): string {
  const text = s.trim().replace(/\s+/g, " ")
  if (text.length <= max) return text
  const window = text.slice(0, max + 1)
  const sentenceEnd = window.search(/[.!?。！？][^.!?。！？]*$/)
  if (sentenceEnd > max * 0.5) return text.slice(0, sentenceEnd + 1).trim()
  const space = window.lastIndexOf(" ")
  if (space > max * 0.5) return text.slice(0, space).trim() + "…"
  return text.slice(0, max).trim() + "…"
}

function stripMarkdown(s: string): string {
  return s.replace(/[*_`#>\[\]()!]/g, "").replace(/\s+/g, " ").trim()
}

function parseTags(body: string): { tags: string[]; cleaned: string } {
  const m = body.match(/^TAGS:\s*(.+)$/m)
  let cleaned = body
  const tags: string[] = ["daily-digest"]
  if (m) {
    cleaned = body.replace(/^TAGS:\s*.+$/m, "").trim()
    for (const raw of m[1].split(",")) {
      const t = raw.trim().toLowerCase().replace(/\s+/g, "-")
      if (t && t !== "daily-digest" && !tags.includes(t) && /^[\p{L}\p{N}-]+$/u.test(t)) {
        tags.push(t)
      }
      if (tags.length >= 5) break
    }
  }
  return { tags, cleaned }
}

function stripLeadingH1(md: string, title: string): string {
  const lines = md.split("\n")
  const first = lines.findIndex((l) => l.trim().length > 0)
  if (first === -1) return md
  const candidate = lines[first].trim()
  if (candidate.startsWith("# ") && candidate.slice(2).trim() === title.trim()) {
    return lines.slice(first + 1).join("\n").replace(/^\n+/, "")
  }
  return md
}

function formatDateLong(date: string, locale: DigestLocale): string {
  const [y, m, d] = date.split("-").map(Number)
  if (locale === "zh") return `${y}年${m}月${d}日`
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function buildMarkdown(
  rawBody: string,
  slug: string,
  date: string,
  locale: DigestLocale,
  topTitle: string
): { markdown: string; title: string; description: string; tags: string[] } {
  const { tags, cleaned } = parseTags(rawBody)
  const body = stripLeadingH1(cleaned, "").trim()
  const dateLong = formatDateLong(date, locale)
  const topShort = smartTruncate(topTitle, locale === "zh" ? 28 : 60).replace(/…$/, "")
  const title =
    locale === "zh"
      ? `今日热点日报 · ${dateLong} — ${topShort}`
      : `Daily digest · ${dateLong} — ${topShort}`

  // Description: first real paragraph of the body, else the top stories.
  const firstPara =
    body
      .split("\n\n")
      .map((b) => b.trim())
      .find((b) => b && !b.startsWith("#") && !b.startsWith("TAGS:")) ?? ""
  const description = firstPara
    ? smartTruncate(stripMarkdown(firstPara), 160)
    : smartTruncate(topTitle, 160)

  const fm = [
    "---",
    `slug: ${slug}`,
    `title: ${quote(title)}`,
    `description: ${quote(description)}`,
    `date: ${date}`,
    `author: ${AUTHOR}`,
    `locale: ${locale}`,
    `tags: [${tags.map((t) => quote(t)).join(", ")}]`,
    "---",
    "",
  ].join("\n")
  return { markdown: fm + "\n" + body + "\n", title, description, tags }
}

// ─── Route ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url)
  const dry = url.searchParams.get("dry") === "1"
  const stub = process.env.DIGEST_STUB_AI === "1" || url.searchParams.get("stub") === "1"

  // 1. Auth — CRON_SECRET is mandatory; the route never runs unprotected.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured — set it in the Vercel dashboard (see DAILY-DIGEST.md)" },
      { status: 500 }
    )
  }
  const authHeader = req.headers.get("authorization")
  const secretParam = url.searchParams.get("secret") ?? url.searchParams.get("token")
  const provided = authHeader ?? (secretParam ? `Bearer ${secretParam}` : null)
  if (provided !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const date = todayUtc()
  const enSlug = slugFor(date, "en")
  const zhSlug = slugFor(date, "zh")

  // 2. Idempotency — if either of today's files already exists, skip.
  const ghToken = process.env.DIGEST_GITHUB_TOKEN
  let existing: string[] = []
  try {
    const checks = await Promise.all([
      githubGetSha(`src/data/posts/${enSlug}.md`, ghToken),
      githubGetSha(`src/data/posts/${zhSlug}.md`, ghToken),
    ])
    if (checks[0]) existing.push(enSlug)
    if (checks[1]) existing.push(zhSlug)
  } catch (e) {
    // In dry mode the check is advisory (nothing is published), so report
    // it and continue. In live mode a failed check blocks the run — we
    // must not risk publishing over an existing file blind.
    if (!dry) {
      return Response.json({ ok: false, error: `idempotency check failed: ${(e as Error).message}` }, { status: 502 })
    }
    console.log(`[daily-digest] idempotency check failed in dry mode, continuing: ${(e as Error).message}`)
  }
  if (existing.length > 0) {
    return Response.json({ ok: true, skipped: "already-published", date, existing })
  }

  // 3. Topics — top 6 per locale from the cross-source clustering.
  let topics: { en: TopicMaterial[]; zh: TopicMaterial[] }
  try {
    topics = await fetchTopics()
  } catch (e) {
    return Response.json({ ok: false, error: `topic fetch failed: ${(e as Error).message}` }, { status: 502 })
  }
  if (topics.en.length < 3 || topics.zh.length < 3) {
    return Response.json(
      {
        ok: false,
        error: `not enough topics (en: ${topics.en.length}, zh: ${topics.zh.length} — need ≥3 each); publishing nothing`,
        topics: { en: topics.en.length, zh: topics.zh.length },
      },
      { status: 422 }
    )
  }
  console.log(`[daily-digest] ${date}: ${topics.en.length} EN topics, ${topics.zh.length} ZH topics`)

  // 4. AI config.
  const providerRaw = (process.env.DIGEST_AI_PROVIDER ?? "deepseek").trim().toLowerCase()
  const provider: AIProvider = isDigestProvider(providerRaw) ? providerRaw : "deepseek"
  if (!isDigestProvider(providerRaw)) {
    console.log(`[daily-digest] unknown DIGEST_AI_PROVIDER "${providerRaw}", falling back to deepseek`)
  }
  const aiKey = process.env.DIGEST_AI_KEY
  if (!stub && !aiKey) {
    return Response.json(
      { ok: false, error: "DIGEST_AI_KEY is not configured — set it in the Vercel dashboard (see DAILY-DIGEST.md)" },
      { status: 500 }
    )
  }
  if (!dry && !ghToken) {
    return Response.json(
      { ok: false, error: "DIGEST_GITHUB_TOKEN is not configured — set it in the Vercel dashboard (see DAILY-DIGEST.md)" },
      { status: 500 }
    )
  }

  // 5. Write both locales (in parallel — they are independent).
  let enBody: string
  let zhBody: string
  if (stub) {
    enBody = stubBody(topics.en, "en")
    zhBody = stubBody(topics.zh, "zh")
  } else {
    try {
      ;[enBody, zhBody] = await Promise.all([
        callAI(provider, aiKey!, systemPrompt("en"), userPrompt(topics.en, "en"), MAX_TOKENS),
        callAI(provider, aiKey!, systemPrompt("zh"), userPrompt(topics.zh, "zh"), MAX_TOKENS),
      ])
    } catch (e) {
      return Response.json({ ok: false, error: `AI call failed (${provider}): ${(e as Error).message}` }, { status: 502 })
    }
  }
  if (!enBody.trim() || !zhBody.trim()) {
    return Response.json({ ok: false, error: "AI returned an empty article; publishing nothing" }, { status: 502 })
  }

  const en = buildMarkdown(enBody, enSlug, date, "en", topics.en[0].title)
  const zh = buildMarkdown(zhBody, zhSlug, date, "zh", topics.zh[0].title)
  console.log(`[daily-digest] built ${enSlug} (${en.tags.join(",")}) + ${zhSlug} (${zh.tags.join(",")})`)

  // 6. Dry run: return the files for inspection, publish nothing.
  if (dry) {
    return Response.json({
      ok: true,
      dry: true,
      date,
      provider,
      stub,
      topics: { en: topics.en.length, zh: topics.zh.length },
      en: { slug: enSlug, title: en.title, description: en.description, tags: en.tags, markdown: en.markdown },
      zh: { slug: zhSlug, title: zh.title, description: zh.description, tags: zh.tags, markdown: zh.markdown },
    })
  }

  // 7. Publish both files.
  const message = `Daily digest ${date} (auto)`
  try {
    const [enPut, zhPut] = await Promise.all([
      githubPutFile(`src/data/posts/${enSlug}.md`, en.markdown, message, ghToken!),
      githubPutFile(`src/data/posts/${zhSlug}.md`, zh.markdown, message, ghToken!),
    ])
    console.log(`[daily-digest] published ${enSlug} + ${zhSlug}`)
    return Response.json({
      ok: true,
      date,
      topics: { en: topics.en.length, zh: topics.zh.length },
      enSlug,
      zhSlug,
      commits: [
        { slug: enSlug, sha: enPut.sha, url: enPut.url },
        { slug: zhSlug, sha: zhPut.sha, url: zhPut.url },
      ],
    })
  } catch (e) {
    return Response.json({ ok: false, error: `GitHub publish failed: ${(e as Error).message}` }, { status: 502 })
  }
}
