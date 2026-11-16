// Distribute panel for /compose: one-click multi-platform 图文 + video.
// Takes the current draft (markdown + output locale) and generates
// ready-to-post versions for X / Weibo / Zhihu / 小红书 (text) and a
// video kit for Bilibili / YouTube / 抖音 / TikTok.
//
// Two generation modes per platform:
//   - Template (default): deterministic formatters in src/lib/distribute.ts
//     — works with zero config, always produces usable output.
//   - AI: "✦ AI 改写" reuses the existing /api/compose endpoint (BYO key,
//     style "custom") and runs the result through the same length
//     enforcers, so platform limits hold either way.
//
// No auto-posting anywhere: every platform is copy/download, because
// posting needs the user's own account (no OAuth, no stored credentials).

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  buildScenes,
  cpLen,
  formatWeibo,
  formatX,
  formatXiaohongshu,
  formatZhihu,
  parseDraft,
  smartTruncate,
  type ParsedDraft,
} from "@/lib/distribute"
import { downloadCanvasPng, drawCoverCard } from "@/lib/cover-card"
import { getAISettings } from "@/lib/ai-settings"
import { VideoKit } from "@/components/compose/VideoKit"

type PlatformId = "x" | "weibo" | "zhihu" | "xhs"

interface Props {
  markdown: string
  outputLocale: "en" | "zh"
  uiLocale: "en" | "zh"
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function CopyButton({
  text,
  label,
  locale,
}: {
  text: string
  label: string
  locale: "en" | "zh"
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
        copied
          ? "border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20"
      }`}
    >
      {copied ? (locale === "zh" ? "✓ 已复制" : "✓ Copied") : label}
    </button>
  )
}

function CoverCanvas({
  title,
  hook,
  url,
  width,
  height,
  filename,
  locale,
}: {
  title: string
  hook: string
  url: string
  width: number
  height: number
  filename: string
  locale: "en" | "zh"
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    drawCoverCard(canvas, {
      title,
      hook,
      url,
      date: new Date().toISOString().slice(0, 10),
      width,
      height,
    })
  }, [title, hook, url, width, height])
  return (
    <div>
      <canvas ref={ref} className="w-full rounded-lg border border-gray-200 dark:border-white/10" />
      <button
        type="button"
        onClick={() => {
          if (ref.current) downloadCanvasPng(ref.current, filename)
        }}
        className="mt-1.5 px-2 py-1 text-[11px] rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors"
      >
        {locale === "zh"
          ? `⬇ 下载封面 PNG（${width}×${height}）`
          : `⬇ Download cover PNG (${width}×${height})`}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AI rewrite: prompts + response parsing
// ---------------------------------------------------------------------------

const AI_PROMPTS: Record<PlatformId, Record<"en" | "zh", string>> = {
  x: {
    en: "Rewrite the article below as an X / Twitter thread in English. Rules: 4–7 tweets, each under 260 characters; number them 1/n, 2/n …; the first tweet is a hook, the last tweet has 2–3 hashtags and the article link. Output ONLY the tweets, one per line, no commentary, no markdown headings, no extra text.",
    zh: "把下面这篇文章改写成一条 X / Twitter 英文 thread。要求：4–7 条，每条不超过 260 字符，编号 1/n、2/n……；第一条是钩子，最后一条带 2–3 个 hashtag 和文章链接。只输出推文内容，每行一条，不要任何解释、不要 markdown 标题。",
  },
  weibo: {
    en: "Rewrite the article below as a Weibo post in Chinese. Rules: under 130 characters total, punchy and newsy, include 1–2 #话题# hashtags. Output ONLY the post text, no commentary.",
    zh: "把下面这篇文章改写成一条微博。要求：全文不超过 130 字，口语化、有冲击力，带 1–2 个 #话题#。只输出微博正文，不要任何解释。",
  },
  zhihu: {
    en: "Rewrite the article below as a Zhihu long-form answer in English. Rules: keep the title, a short intro, then 3 key points under ### subheadings, then a one-paragraph conclusion. Output Markdown only, no commentary.",
    zh: "把下面这篇文章改写成一篇知乎长文。要求：保留标题、一段导语、3 个要点（用 ### 小标题）、一段结语。只输出 Markdown，不要任何解释。",
  },
  xhs: {
    en: "Rewrite the article below as a Xiaohongshu post in Chinese. Rules: first line is a catchy title under 20 characters with 1–2 emoji; then short paragraphs with line breaks, emoji bullets, and 3–5 #tags at the end. Output ONLY the post, no commentary.",
    zh: "把下面这篇文章改写成一篇小红书笔记。要求：第一行是 20 字以内的吸睛标题（带 1–2 个 emoji）；正文短段落、空行分隔、emoji 要点、结尾 3–5 个 #标签。只输出笔记内容，不要任何解释。",
  },
}

/** Strip numbering / bullets / markdown emphasis from an AI line. */
function cleanAiLine(line: string): string {
  return line
    .replace(/^(\d+[./、）)]|\(\d+\)|[-*•·])\s*/, "")
    .replace(/[*_`]/g, "")
    .trim()
}

/** Parse the AI thread response into numbered tweets (≤ 280 chars). */
function parseAiThread(md: string): string[] {
  const lines = md
    .split("\n")
    .map(cleanAiLine)
    .filter((l) => l.length > 0 && !/^#+\s/.test(l))
  let tweets: string[]
  if (lines.length >= 2) {
    tweets = lines.map((l) => smartTruncate(l, 270))
  } else {
    // Single block: split into sentences and pack into ≤ 270-char tweets.
    const text = lines.join(" ")
    const sents = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) ?? [text]
    tweets = []
    let cur = ""
    for (const s of sents.map((x) => x.trim()).filter(Boolean)) {
      const joined = cur ? `${cur} ${s}` : s
      if (cpLen(joined) <= 270) cur = joined
      else {
        if (cur) tweets.push(cur)
        cur = smartTruncate(s, 270)
      }
    }
    if (cur) tweets.push(cur)
    if (tweets.length === 0) tweets = [smartTruncate(text, 270)]
  }
  const n = tweets.length
  return tweets.map((t, i) => `${t} ${i + 1}/${n}`)
}

/** Parse the AI Weibo response into ≤ 140-char posts. */
function parseAiWeibo(md: string): string[] {
  const text = md
    .split("\n")
    .map(cleanAiLine)
    .filter(Boolean)
    .join(" ")
  const sents = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) ?? [text]
  const posts: string[] = []
  let cur = ""
  for (const s of sents.map((x) => x.trim()).filter(Boolean)) {
    const joined = cur ? `${cur} ${s}` : s
    if (cpLen(joined) <= 132) cur = joined
    else {
      if (cur) posts.push(cur)
      cur = smartTruncate(s, 132)
    }
  }
  if (cur) posts.push(cur)
  if (posts.length === 0) posts.push(smartTruncate(text, 132))
  if (posts.length === 1) return posts
  return posts.map((p, i) => {
    const suffix = `(${i + 1}/${posts.length})`
    return `${smartTruncate(p, 140 - cpLen(suffix))} ${suffix}`
  })
}

function stripCodeFences(md: string): string {
  return md.replace(/^```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const PLATFORM_META: Record<
  PlatformId,
  { name: string; icon: string; cover: { w: number; h: number } }
> = {
  x: { name: "X / Twitter", icon: "𝕏", cover: { w: 1200, h: 675 } },
  weibo: { name: "Weibo 微博", icon: "👁️", cover: { w: 1200, h: 630 } },
  zhihu: { name: "Zhihu 知乎", icon: "知", cover: { w: 1200, h: 630 } },
  xhs: { name: "小红书", icon: "📕", cover: { w: 1080, h: 1080 } },
}

// All 8 distribution targets, shown as greyed-out previews while there
// is no draft yet (text platforms + video platforms).
const PREVIEW_PLATFORMS: { icon: string; name: string }[] = [
  { icon: "𝕏", name: "X / Twitter" },
  { icon: "👁️", name: "Weibo 微博" },
  { icon: "知", name: "Zhihu 知乎" },
  { icon: "📕", name: "小红书" },
  { icon: "📺", name: "Bilibili" },
  { icon: "▶️", name: "YouTube" },
  { icon: "🎵", name: "抖音" },
  { icon: "🎵", name: "TikTok" },
]

export function DistributePanel({ markdown, outputLocale, uiLocale }: Props) {
  const locale = uiLocale
  const tCompose = useTranslations("compose")
  const empty = !markdown.trim()
  const draft: ParsedDraft | null = useMemo(
    () => (empty ? null : parseDraft(markdown, outputLocale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markdown, outputLocale, empty]
  )

  const xTemplate = useMemo(() => (draft ? formatX(draft) : null), [draft])
  const weiboTemplate = useMemo(() => (draft ? formatWeibo(draft) : null), [draft])
  const zhihuTemplate = useMemo(() => (draft ? formatZhihu(draft) : null), [draft])
  const xhsTemplate = useMemo(() => (draft ? formatXiaohongshu(draft) : null), [draft])
  const scenes = useMemo(() => (draft ? buildScenes(draft) : []), [draft])

  const [aiX, setAiX] = useState<string[] | null>(null)
  const [aiWeibo, setAiWeibo] = useState<string[] | null>(null)
  const [aiZhihu, setAiZhihu] = useState<string | null>(null)
  const [aiXhs, setAiXhs] = useState<{ title: string; body: string } | null>(null)
  const [aiLoading, setAiLoading] = useState<Record<PlatformId, boolean>>({
    x: false,
    weibo: false,
    zhihu: false,
    xhs: false,
  })
  const [aiError, setAiError] = useState<string | null>(null)

  async function aiRewrite(platform: PlatformId) {
    if (!draft) return
    const settings = getAISettings()
    if (!settings?.apiKey || settings.provider === "gemini-nano") {
      setAiError(
        locale === "zh"
          ? "AI 改写需要先在主页 ✦ 里设置云端 AI key（OpenAI / Claude / DeepSeek / 智谱 / Gemini）。模板版可直接用，无需 key。"
          : "AI rewrite needs a cloud AI key set in ✦ on the home page (OpenAI / Claude / DeepSeek / Zhipu / Gemini). The template version works without one."
      )
      return
    }
    setAiError(null)
    setAiLoading((prev) => ({ ...prev, [platform]: true }))
    try {
      const excerpt = draft.paragraphs.join("\n\n").slice(0, 3000)
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.apiKey,
          locale: outputLocale,
          style: "custom",
          customPrompt: AI_PROMPTS[platform][outputLocale],
          materials: [
            {
              sourceName: "TideNow",
              title: draft.title,
              url: draft.url,
              extra: excerpt,
            },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const text = stripCodeFences(data.markdown ?? "")
      if (!text) throw new Error(locale === "zh" ? "AI 返回了空内容" : "AI returned empty content")
      if (platform === "x") setAiX(parseAiThread(text))
      else if (platform === "weibo") setAiWeibo(parseAiWeibo(text))
      else if (platform === "zhihu") setAiZhihu(text)
      else {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
        const titleLine = lines[0] ?? ""
        const title = smartTruncate(titleLine, 20).replace(/…$/, "")
        const body = lines.slice(1).join("\n").trim() || text
        setAiXhs({ title, body })
      }
    } catch (e) {
      setAiError((e as Error).message)
    } finally {
      setAiLoading((prev) => ({ ...prev, [platform]: false }))
    }
  }

  function resetAi(platform: PlatformId) {
    if (platform === "x") setAiX(null)
    else if (platform === "weibo") setAiWeibo(null)
    else if (platform === "zhihu") setAiZhihu(null)
    else setAiXhs(null)
  }

  const isAi = (p: PlatformId) =>
    p === "x" ? aiX !== null : p === "weibo" ? aiWeibo !== null : p === "zhihu" ? aiZhihu !== null : aiXhs !== null

  function aiButton(p: PlatformId) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => aiRewrite(p)}
          disabled={aiLoading[p]}
          className="px-2 py-0.5 text-[11px] rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-40"
        >
          {aiLoading[p]
            ? locale === "zh" ? "✦ 改写中…" : "✦ Rewriting…"
            : locale === "zh" ? "✦ AI 改写" : "✦ AI rewrite"}
        </button>
        {isAi(p) && (
          <button
            type="button"
            onClick={() => resetAi(p)}
            className="px-1.5 py-0.5 text-[11px] rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            title={locale === "zh" ? "回到模板版" : "Back to template"}
          >
            ↩ {locale === "zh" ? "模板" : "Template"}
          </button>
        )}
      </span>
    )
  }

  function modeBadge(p: PlatformId) {
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          isAi(p)
            ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
            : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400"
        }`}
      >
        {isAi(p) ? "AI" : locale === "zh" ? "模板" : "Template"}
      </span>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-4 py-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            📣 {locale === "zh" ? "多平台分发" : "Distribute"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed max-w-2xl">
            {locale === "zh"
              ? "把当前草稿一键改写成各平台格式：复制粘贴即可发布。模板版零配置直接可用；点「✦ AI 改写」会用你已设置的 AI key 重新润色（key 不够时仍显示模板版）。"
              : "Turn the current draft into ready-to-post versions per platform — copy and paste to publish. The template version works with zero setup; “✦ AI rewrite” re-polishes it with your configured AI key (template stays available when no key is set)."}
          </p>
        </div>
      </div>

      {empty || !draft ? (
        // Preview state — the panel must advertise distribution BEFORE
        // the user has a draft, or nobody learns it exists. The 8
        // platform tiles are greyed-out previews, not buttons.
        <div className="mt-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
            🔒 {tCompose("distributeUnlock")}
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" aria-hidden>
            {PREVIEW_PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] px-3 py-2.5 opacity-60"
              >
                <span aria-hidden className="text-base leading-none">{p.icon}</span>
                <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 truncate">{p.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-400 dark:text-zinc-500 italic">
            {locale === "zh"
              ? "先在上方生成或写一篇草稿，这里会自动生成各平台版本。"
              : "Generate or write a draft above first — platform versions appear here automatically."}
          </p>
        </div>
      ) : (
        <>
          {aiError && (
            <p className="mt-3 text-xs text-rose-500 leading-snug bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">
              {aiError}
            </p>
          )}

          {/* Text platforms */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* X / Twitter */}
            <article className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-3">
              <header className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-zinc-200">
                  <span aria-hidden>{PLATFORM_META.x.icon}</span> {PLATFORM_META.x.name}
                  {modeBadge("x")}
                </span>
                {aiButton("x")}
              </header>
              <div className="flex flex-col gap-1.5">
                {(aiX ?? xTemplate?.tweets ?? []).map((t, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] px-2.5 py-2"
                  >
                    <p className="flex-1 min-w-0 text-xs leading-relaxed text-gray-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                      {t}
                    </p>
                    <span className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500">{cpLen(t)}/280</span>
                      <CopyButton text={t} label={locale === "zh" ? "复制" : "Copy"} locale={locale} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <CopyButton
                  text={(aiX ?? xTemplate?.tweets ?? []).join("\n\n")}
                  label={locale === "zh" ? "📋 复制全部推文" : "📋 Copy all tweets"}
                  locale={locale}
                />
              </div>
              <CoverCanvas
                title={draft.title}
                hook={draft.description}
                url={draft.url}
                width={PLATFORM_META.x.cover.w}
                height={PLATFORM_META.x.cover.h}
                filename={`tidenow-cover-x-${draft.slug}.png`}
                locale={locale}
              />
            </article>

            {/* Weibo */}
            <article className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-3">
              <header className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-zinc-200">
                  <span aria-hidden>{PLATFORM_META.weibo.icon}</span> {PLATFORM_META.weibo.name}
                  {modeBadge("weibo")}
                </span>
                {aiButton("weibo")}
              </header>
              <div className="flex flex-col gap-1.5">
                {(aiWeibo ?? weiboTemplate?.posts ?? []).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] px-2.5 py-2"
                  >
                    <p className="flex-1 min-w-0 text-xs leading-relaxed text-gray-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                      {p}
                    </p>
                    <span className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500">{cpLen(p)}/140</span>
                      <CopyButton text={p} label={locale === "zh" ? "复制" : "Copy"} locale={locale} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <CopyButton
                  text={(aiWeibo ?? weiboTemplate?.posts ?? []).join("\n\n")}
                  label={locale === "zh" ? "📋 复制全部" : "📋 Copy all"}
                  locale={locale}
                />
              </div>
              <CoverCanvas
                title={draft.title}
                hook={draft.description}
                url={draft.url}
                width={PLATFORM_META.weibo.cover.w}
                height={PLATFORM_META.weibo.cover.h}
                filename={`tidenow-cover-weibo-${draft.slug}.png`}
                locale={locale}
              />
            </article>

            {/* Zhihu */}
            <article className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-3">
              <header className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-zinc-200">
                  <span aria-hidden>{PLATFORM_META.zhihu.icon}</span> {PLATFORM_META.zhihu.name}
                  {modeBadge("zhihu")}
                </span>
                {aiButton("zhihu")}
              </header>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                {aiZhihu ?? zhihuTemplate ?? ""}
              </pre>
              <div className="flex items-center gap-1.5">
                <CopyButton
                  text={aiZhihu ?? zhihuTemplate ?? ""}
                  label={locale === "zh" ? "📋 复制全文" : "📋 Copy article"}
                  locale={locale}
                />
              </div>
              <CoverCanvas
                title={draft.title}
                hook={draft.description}
                url={draft.url}
                width={PLATFORM_META.zhihu.cover.w}
                height={PLATFORM_META.zhihu.cover.h}
                filename={`tidenow-cover-zhihu-${draft.slug}.png`}
                locale={locale}
              />
            </article>

            {/* 小红书 */}
            <article className="rounded-lg border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-3">
              <header className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-zinc-200">
                  <span aria-hidden>{PLATFORM_META.xhs.icon}</span> {PLATFORM_META.xhs.name}
                  {modeBadge("xhs")}
                </span>
                {aiButton("xhs")}
              </header>
              <div className="rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2">
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 leading-snug">
                  {(aiXhs ?? xhsTemplate)?.title}
                  <span className="ml-2 text-[10px] font-normal text-gray-400 dark:text-zinc-500">
                    {cpLen((aiXhs ?? xhsTemplate)?.title ?? "")}/20
                  </span>
                </p>
                <pre className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-zinc-300">
                  {(aiXhs ?? xhsTemplate)?.body}
                </pre>
              </div>
              <div className="flex items-center gap-1.5">
                <CopyButton
                  text={`${(aiXhs ?? xhsTemplate)?.title ?? ""}\n\n${(aiXhs ?? xhsTemplate)?.body ?? ""}`}
                  label={locale === "zh" ? "📋 复制标题+正文" : "📋 Copy title + body"}
                  locale={locale}
                />
              </div>
              <CoverCanvas
                title={draft.title}
                hook={draft.description}
                url={draft.url}
                width={PLATFORM_META.xhs.cover.w}
                height={PLATFORM_META.xhs.cover.h}
                filename={`tidenow-cover-xiaohongshu-${draft.slug}.png`}
                locale={locale}
              />
            </article>
          </div>

          {/* Video */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              🎬 {locale === "zh" ? "视频 · Bilibili / YouTube / 抖音 / TikTok" : "Video · Bilibili / YouTube / Douyin / TikTok"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {locale === "zh"
                ? "同一篇草稿生成短视频：分镜脚本 + 旁白 + 字幕 + 幻灯片视频。视频静音，配音和字幕在剪映 / CapCut 里加。"
                : "The same draft becomes a short video: storyboard + narration + subtitles + a slideshow video. The video is silent — add voiceover and subtitles in CapCut / 剪映."}
            </p>
            <div className="mt-3">
              <VideoKit
                title={draft.title}
                hook={draft.description}
                scenes={scenes}
                postUrl={draft.url}
                locale={outputLocale}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-400 dark:text-zinc-500 leading-snug">
              {locale === "zh"
                ? "提示：封面图和视频里的文章链接是按标题生成的，发布文章后才生效——先点上方「🚀 Publish」发布，再去各平台发。"
                : "Note: the article link in covers and videos is derived from the title and goes live once you publish — hit “🚀 Publish” above first, then post to each platform."}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
