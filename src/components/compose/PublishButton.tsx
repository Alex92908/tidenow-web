"use client"

import { useEffect, useState } from "react"
import {
  getGitHubToken,
  saveGitHubToken,
  clearGitHubToken,
} from "@/lib/github-settings"

interface Props {
  markdown: string
  outputLocale: "en" | "zh"
  uiLocale: "en" | "zh"
}

// "Publish" on TideNow means: the file ends up in src/data/posts/ via
// a git commit. There are two ways to get there from this modal:
//   1. Download the commit-ready .md and push it yourself (works for
//      everyone, no credentials needed).
//   2. One-click publish (BYO GitHub token): the browser PUTs the file
//      straight to the GitHub Contents API. The token is the site
//      owner's own, stored only in their browser localStorage (same
//      pattern as the AI keys) — this is NOT a UGC auto-publish pipe:
//      nobody without a repo-write token can publish anything, so the
//      spam/AdSense reasoning in docs/2026-05-31-session-notes.md still
//      holds. Vercel auto-deploys on push.

const REPO = "Alex92908/tidenow-web"
const SITE_URL = "https://www.tide-now.com"
const TOKEN_URL = "https://github.com/settings/tokens?type=beta"

export function PublishButton({ markdown, outputLocale, uiLocale }: Props) {
  const [open, setOpen] = useState(false)
  const empty = !markdown.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={empty}
        title={
          uiLocale === "zh"
            ? "导出可提交到仓库的 .md 文件"
            : "Export a commit-ready .md file"
        }
        className="px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        📤 {uiLocale === "zh" ? "导出发布文件" : "Export for publish"}
      </button>
      {open && (
        <PublishModal
          markdown={markdown}
          outputLocale={outputLocale}
          uiLocale={uiLocale}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// One-click publish entry point — sits next to "Export for publish" in
// ComposeApp and opens the same modal, with the publish section as the
// focus. The download fallback stays available inside the modal.
export function PublishToSiteButton({ markdown, outputLocale, uiLocale }: Props) {
  const [open, setOpen] = useState(false)
  const empty = !markdown.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={empty}
        title={
          uiLocale === "zh"
            ? "用 GitHub token 一键发布到网站"
            : "Publish to the site with a GitHub token"
        }
        className="px-3 py-1 text-xs rounded-md bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🚀 {uiLocale === "zh" ? "发布" : "Publish"}
      </button>
      {open && (
        <PublishModal
          markdown={markdown}
          outputLocale={outputLocale}
          uiLocale={uiLocale}
          publishFirst
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

type PublishStatus =
  | "idle"
  | "checking"
  | "confirm-overwrite"
  | "publishing"
  | "success"
  | "error"

function PublishModal({
  markdown,
  outputLocale,
  uiLocale,
  publishFirst = false,
  onClose,
}: {
  markdown: string
  outputLocale: "en" | "zh"
  uiLocale: "en" | "zh"
  publishFirst?: boolean
  onClose: () => void
}) {
  // Pre-fill from the markdown body so the user only confirms — they're
  // not asked to re-type things they already wrote.
  const derived = deriveDefaults(markdown)
  const [slug, setSlug] = useState(derived.slug)
  const [title, setTitle] = useState(derived.title)
  const [description, setDescription] = useState(derived.description)
  const [author, setAuthor] = useState("Alex")
  const [tags, setTags] = useState("")
  const [cover, setCover] = useState(derived.cover)

  const date = new Date().toISOString().slice(0, 10)

  // One-click publish state. The GitHub token is loaded from
  // localStorage on mount (same BYO pattern as the AI keys).
  const [token, setToken] = useState("")
  const [tokenSaved, setTokenSaved] = useState(false)
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle")
  const [publishError, setPublishError] = useState("")
  const [publishedUrl, setPublishedUrl] = useState("")
  const [existingSha, setExistingSha] = useState<string | null>(null)

  useEffect(() => {
    const saved = getGitHubToken()
    if (saved) {
      setToken(saved)
      setTokenSaved(true)
    }
  }, [])

  function postUrl(s: string): string {
    return outputLocale === "zh"
      ? `${SITE_URL}/zh/posts/${s}`
      : `${SITE_URL}/posts/${s}`
  }

  function buildFile(): string {
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    // YAML-ish: enough for our hand-rolled parser in src/lib/posts.ts.
    // Quote values that contain colons or other YAML metacharacters.
    const fm: string[] = [
      "---",
      `slug: ${slug}`,
      `title: ${quote(title)}`,
      description ? `description: ${quote(description)}` : "",
      `date: ${date}`,
      author ? `author: ${quote(author)}` : "",
      `locale: ${outputLocale}`,
      tagList.length > 0 ? `tags: [${tagList.map((t) => quote(t)).join(", ")}]` : "",
      cover ? `cover: ${cover}` : "",
      "---",
      "",
    ].filter(Boolean)
    // Strip a leading H1 from the body if it matches the title — the
    // detail page already renders the title as <h1>, so leaving it in
    // the body would render twice.
    const cleaned = stripLeadingH1(markdown, title)
    return fm.join("\n") + "\n" + cleaned + "\n"
  }

  function handleDownload() {
    const filename = `${slug || "untitled"}.md`
    const blob = new Blob([buildFile()], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildFile())
  }

  function handleSaveToken() {
    const v = token.trim()
    if (!v) return
    saveGitHubToken(v)
    setToken(v)
    setTokenSaved(true)
  }

  function handleClearToken() {
    clearGitHubToken()
    setToken("")
    setTokenSaved(false)
  }

  // PUT the built .md to the GitHub Contents API. `sha` is null for a
  // new file, or the existing file's sha when overwriting.
  async function doPut(sha: string | null) {
    const t = (zh: string, en: string) => (uiLocale === "zh" ? zh : en)
    setPublishStatus("publishing")
    try {
      const putRes = await fetch(
        `https://api.github.com/repos/${REPO}/contents/src/data/posts/${slug}.md`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Publish: ${slug}`,
            content: toBase64Utf8(buildFile()),
            ...(sha ? { sha } : {}),
          }),
        }
      )
      if (putRes.status === 401) {
        setPublishError(t("Token 无效或已过期，请检查后重新保存", "Token is invalid or expired — check it and save again"))
        setPublishStatus("error")
        return
      }
      if (putRes.status === 403) {
        setPublishError(
          t(
            "Token 权限不足：需要对 Alex92908/tidenow-web 的 Contents 读写权限（细粒度 token 勾选 Contents: Read and write，或 classic token 的 repo 权限）",
            "Token lacks permission: it needs Contents read + write on Alex92908/tidenow-web (fine-grained Contents: Read and write, or classic repo scope)"
          )
        )
        setPublishStatus("error")
        return
      }
      if (putRes.status === 422) {
        setPublishError(t("GitHub 校验失败（可能是文件已被他人改动）— 请关闭后重试", "GitHub validation failed (the file may have changed) — close and retry"))
        setPublishStatus("error")
        return
      }
      if (!putRes.ok) {
        setPublishError(t(`发布失败：GitHub 返回 ${putRes.status}`, `Publish failed: GitHub returned ${putRes.status}`))
        setPublishStatus("error")
        return
      }
      setPublishedUrl(postUrl(slug))
      setPublishStatus("success")
    } catch {
      setPublishError(t("网络错误：没能连上 GitHub，请检查网络后重试", "Network error — couldn't reach GitHub, check your connection and retry"))
      setPublishStatus("error")
    }
  }

  // One-click publish: PUT the .md to the GitHub Contents API. If the
  // file already exists we ask before overwriting (update needs its sha).
  async function handlePublish() {
    const t = (zh: string, en: string) => (uiLocale === "zh" ? zh : en)
    const tok = token.trim()
    if (!tok) {
      setPublishError(t("请先在下方填写 GitHub token", "Add a GitHub token below first"))
      setPublishStatus("error")
      return
    }
    if (!slug || !title) {
      setPublishError(t("请先填写 slug 和标题", "Fill in the slug and title first"))
      setPublishStatus("error")
      return
    }
    setPublishError("")
    setPublishedUrl("")
    setPublishStatus("checking")
    const path = `src/data/posts/${slug}.md`
    const apiUrl = `https://api.github.com/repos/${REPO}/contents/${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tok}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }
    try {
      // Does the file already exist? (404 = new file, create path.)
      const getRes = await fetch(apiUrl, { headers })
      if (getRes.status === 401) {
        setPublishError(t("Token 无效或已过期，请检查后重新保存", "Token is invalid or expired — check it and save again"))
        setPublishStatus("error")
        return
      }
      if (getRes.status === 403) {
        setPublishError(t("GitHub 拒绝了请求（可能是 token 权限不足或触发限流）", "GitHub refused the request (token may lack permission, or rate-limited)"))
        setPublishStatus("error")
        return
      }
      if (getRes.ok) {
        const existing = (await getRes.json()) as { sha?: string }
        setExistingSha(existing.sha ?? null)
        setPublishStatus("confirm-overwrite")
        return
      }
      if (getRes.status !== 404) {
        setPublishError(t(`GitHub 返回了 ${getRes.status}，请稍后重试`, `GitHub returned ${getRes.status} — please retry later`))
        setPublishStatus("error")
        return
      }
      await doPut(null)
    } catch {
      setPublishError(t("网络错误：没能连上 GitHub，请检查网络后重试", "Network error — couldn't reach GitHub, check your connection and retry"))
      setPublishStatus("error")
    }
  }

  const t = (zh: string, en: string) => (uiLocale === "zh" ? zh : en)
  const busy = publishStatus === "checking" || publishStatus === "publishing"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 shadow-xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {publishFirst
              ? `🚀 ${t("发布到网站", "Publish to site")}`
              : `📤 ${t("导出发布文件", "Export for publish")}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <Field label={t("slug · URL 段", "slug · URL segment")} hint={t("决定文章 URL，只能小写字母数字和连字符", "Sets the URL. Lowercase alnum + dashes.")}>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className={inputClass}
              placeholder="my-article"
            />
          </Field>

          <Field label={t("title · 标题", "title")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>

          <Field label={t("description · 一句话摘要 (SEO)", "description · one-liner (SEO)")}>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t("author", "author")}>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("date", "date")}>
              <input value={date} readOnly className={`${inputClass} opacity-60`} />
            </Field>
          </div>

          <Field label={t("tags · 逗号分隔（可选）", "tags · comma-separated (optional)")}>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="ai, weekly" />
          </Field>

          <Field label={t("cover · 封面图 URL（可选）", "cover · cover image URL (optional)")}>
            <input value={cover} onChange={(e) => setCover(e.target.value)} className={inputClass} placeholder="https://..." />
          </Field>

          {/* GitHub token — one-click publish. Same BYO pattern as the
              AI keys: stored only in this browser's localStorage, the
              request goes straight to api.github.com. */}
          <div className="pt-2 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] text-gray-500 dark:text-zinc-500 font-medium">
                {t("GitHub token · 一键发布", "GitHub token · one-click publish")}
              </label>
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-500 hover:underline"
              >
                {t("创建 token →", "Create a token →")}
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value)
                  setTokenSaved(false)
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
                placeholder="ghp_... / github_pat_..."
                className={inputClass}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={!token.trim() || tokenSaved}
                className="shrink-0 px-3 py-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {tokenSaved ? t("✓ 已保存", "✓ Saved") : t("保存", "Save")}
              </button>
              {tokenSaved && (
                <button
                  type="button"
                  onClick={handleClearToken}
                  className="shrink-0 px-2 py-1.5 rounded-md text-gray-400 hover:text-rose-500"
                  title={t("清除 token", "Clear token")}
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1 leading-relaxed">
              {t(
                "细粒度 token：对 Alex92908/tidenow-web 开 Contents 的 Read and write；或 classic token 的 repo 权限。只存在这个浏览器里，跟 AI key 一样，不经过我们的服务器。",
                "Fine-grained token: Contents Read and write on Alex92908/tidenow-web (or classic repo scope). Stored only in this browser, like your AI keys — never sent to our server."
              )}
            </p>
          </div>

          <div className="mt-4 p-3 rounded-md bg-sky-50 dark:bg-sky-500/10 text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed">
            {publishFirst
              ? t(
                  "点下方「发布到网站」，文件会直接提交到仓库，Vercel 自动部署，几分钟后文章出现在 /posts/" + slug + "。也可以先下载 .md，手动 git push。",
                  "Hit “Publish to site” below — the file commits straight to the repo, Vercel auto-deploys, and the post lands at /posts/" + slug + " in a few minutes. Or download the .md and push it manually."
                )
              : t(
                  "下载后，把文件放到本地仓库的 src/data/posts/ 目录，git push 后 Vercel 会自动部署。文章会出现在 /posts/" + slug + "。也可以用下方的「发布到网站」一键提交。",
                  "Drop the file into src/data/posts/ in your local clone and git push. Vercel auto-deploys; the post lands at /posts/" + slug + ". Or use “Publish to site” below to push it directly."
                )}
          </div>

          {/* Publish status */}
          {publishStatus === "confirm-overwrite" && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              <p className="font-medium mb-2">
                {t(
                  `已经有一篇 slug 为 ${slug} 的文章在网站上了，确定要覆盖它吗？`,
                  `A post with slug ${slug} already exists on the site. Overwrite it?`
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void doPut(existingSha)}
                  className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {t("覆盖", "Overwrite")}
                </button>
                <button
                  type="button"
                  onClick={() => setPublishStatus("idle")}
                  className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400"
                >
                  {t("取消", "Cancel")}
                </button>
              </div>
            </div>
          )}
          {(publishStatus === "checking" || publishStatus === "publishing") && (
            <p className="p-3 rounded-md bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500 dark:text-zinc-400">
              {publishStatus === "checking"
                ? t("正在检查文章是否已存在…", "Checking whether the post already exists…")
                : t("正在发布到 GitHub…", "Publishing to GitHub…")}
            </p>
          )}
          {publishStatus === "success" && publishedUrl && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
              <p className="font-medium">✓ {t("发布成功", "Published")}</p>
              <p className="mt-1">
                <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {publishedUrl}
                </a>
              </p>
              <p className="mt-1 opacity-80">
                {t("Vercel 会自动部署，几分钟后文章上线。", "Vercel auto-deploys — the post goes live in a few minutes.")}
              </p>
            </div>
          )}
          {publishStatus === "error" && publishError && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-500/10 text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
              {publishError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200"
            >
              {t("复制全文", "Copy text")}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!slug || !title}
              className="px-4 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ⤓ {t("下载 .md", "Download .md")}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!slug || !title || busy}
              className="px-4 py-1.5 text-xs rounded-md bg-sky-500 hover:bg-sky-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🚀 {busy ? t("发布中…", "Publishing…") : t("发布到网站", "Publish to site")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  "w-full rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-gray-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-400"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 dark:text-zinc-500 mb-1 font-medium">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────

function deriveDefaults(markdown: string): {
  slug: string
  title: string
  description: string
  cover: string
} {
  const h1 = markdown.match(/^#\s+(.+)$/m)
  const title = h1 ? h1[1].trim() : ""

  // First paragraph (skip headings, blank lines, image-only lines).
  const firstPara =
    markdown
      .split("\n\n")
      .map((b) => b.trim())
      .find((b) => b && !b.startsWith("#") && !b.startsWith("![") && !b.startsWith("---")) ?? ""

  // Strip inline markdown so the description reads cleanly. Then break at
  // a sentence end or word boundary rather than mid-word — '... recent d'
  // (literally cut at a space-less char) is what users see otherwise.
  const description = smartTruncate(firstPara.replace(/[*_`]/g, ""), 160)

  // First image's URL → cover suggestion.
  const img = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/)
  const cover = img ? img[1] : ""

  return { slug: slugify(title), title, description, cover }
}

/**
 * Truncate respecting natural breaks:
 *   1. Prefer the last `.`/`。`/`！`/`？`/`!`/`?` that ends a clause within the
 *      target window — gives us a complete sentence.
 *   2. Fall back to the last whitespace before the limit + ellipsis — avoids
 *      severing words like 'recent d…'.
 *   3. Only as a last resort do we hard-slice (e.g. for CJK runs with no
 *      spaces, where char-by-char IS the natural break).
 */
function smartTruncate(s: string, max: number): string {
  const text = s.trim().replace(/\s+/g, " ")
  if (text.length <= max) return text

  // Look back from `max` for a sentence terminator.
  const window = text.slice(0, max + 1)
  const sentenceEnd = window.search(/[.!?。！？][^.!?。！？]*$/)
  if (sentenceEnd > max * 0.5) {
    // The regex matches the start of the *last* sentence's trailing tail;
    // we want the punctuation itself, which sits just before that match.
    return text.slice(0, sentenceEnd + 1).trim()
  }

  // Fall back to last word boundary.
  const space = window.lastIndexOf(" ")
  if (space > max * 0.5) {
    return text.slice(0, space).trim() + "…"
  }

  // No reasonable break — accept a hard cut + ellipsis. Common for CJK
  // text that's one continuous run.
  return text.slice(0, max).trim() + "…"
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // drop punctuation incl. CJK (CJK slugs aren't URL-safe enough)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

function quote(s: string): string {
  // Quote anything containing a colon, hash, leading dash, or yaml-special
  // char so the frontmatter parser doesn't choke.
  if (/[:#\[\]{}"',|>&*!%@`]|^-/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  return s
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

// Base64-encode a UTF-8 string. btoa() only handles Latin-1, so encode to
// bytes first (chunked fromCharCode to avoid blowing the call stack on
// long articles).
function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return btoa(bin)
}
