import type { Metadata } from "next"
import Link from "next/link"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export const revalidate = 604_800

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const title = locale === "zh" ? "关于 TideNow | TideNow" : "About | TideNow"
  const description =
    locale === "zh"
      ? "TideNow 是谁做的、为什么做、用什么做的。"
      : "Who built TideNow, why, and how."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/about` : `${SITE_URL}/about`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/about`,
        "zh-Hans": `${SITE_URL}/zh/about`,
        "x-default": `${SITE_URL}/about`,
      },
    },
    openGraph: { type: "article", url: canonical, title, description },
  }
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const lang: "en" | "zh" = locale === "zh" ? "zh" : "en"
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-6">
        <Link
          href={lang === "zh" ? "/zh" : "/"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          ← TideNow
        </Link>
      </nav>

      {lang === "zh" ? <AboutZh /> : <AboutEn />}
    </main>
  )
}

function AboutEn() {
  return (
    <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>About TideNow</h1>

      <p>
        TideNow is a real-time aggregator of 60+ public trending feeds —
        Hacker News, Reddit, GitHub Trending, Product Hunt, Apple Music,
        BBC, Reuters, AP, plus Chinese sources like Weibo, Zhihu,
        Bilibili, and 36kr.
      </p>

      <h2>Why it exists</h2>
      <p>
        I used to keep about 8 browser tabs open every morning to track
        what was happening across HN, Reddit, BBC, Reuters, Weibo, Zhihu,
        GitHub Trending, and Product Hunt. The same story often appeared
        in 2–3 of them at once, but the framing was always different —
        what HN called a "leaked memo" Weibo treated as a strategic
        announcement. Triangulating which version was closest to the
        truth ate half my coffee. TideNow exists so I don't have to do
        that ritual anymore.
      </p>

      <h2>What makes it different</h2>
      <p>
        The cross-source "Trending" panel at the top isn't just a list —
        it runs union-find clustering with a stemmer over titles, so the
        same story appearing on Reuters and Weibo in the same window
        shows up as one cluster with both source badges. You can tell at
        a glance whether something is a genuine cross-cultural moment
        (rare) or just one regional outlet's editorial pick.
      </p>
      <p>
        The Compose tool at
        <Link href="/compose">{" "}/compose</Link>
        {" "}lets you pick 1–5 trending items, generate a draft with
        your own AI key (no SaaS markup), edit in a split-pane markdown
        editor, and export a publish-ready{" "}<code>.md</code> file. The
        published editorial pieces live at
        <Link href="/posts">{" "}/posts</Link>.
      </p>

      <h2>Built with</h2>
      <ul>
        <li><a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">Next.js 16</a> (App Router, Turbopack)</li>
        <li><a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer">Tailwind CSS v4</a></li>
        <li><a href="https://next-intl.dev" target="_blank" rel="noopener noreferrer">next-intl</a> for English / 简体中文</li>
        <li><a href="https://github.com/WiseLibs/better-sqlite3" target="_blank" rel="noopener noreferrer">better-sqlite3</a> for the source cache and AI summary memoisation</li>
        <li>Deployed on <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a>, DNS on Cloudflare</li>
      </ul>

      <h2>It's open source</h2>
      <p>
        The full source is on GitHub under MIT:
        <a href="https://github.com/Alex92908/tidenow-web" target="_blank" rel="noopener noreferrer">
          {" "}github.com/Alex92908/tidenow-web
        </a>. Pull requests welcome — especially new sources, scraper
        fixes when upstream APIs rotate, and translation improvements.
      </p>

      <h2>Who</h2>
      <p>
        Built by Alex, an independent developer based in China. Side
        project, evenings and weekends. Reach me at
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>
        {" "}or join the Discord:
        <a href="https://discord.gg/chjPuC963T" target="_blank" rel="noopener noreferrer">
          {" "}discord.gg/chjPuC963T
        </a>.
      </p>
    </article>
  )
}

function AboutZh() {
  return (
    <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>关于 TideNow</h1>

      <p>
        TideNow 是一个聚合 60+ 个公开热榜的实时聚合站——Hacker News、Reddit、GitHub Trending、Product Hunt、Apple Music、BBC、路透、AP,以及微博、知乎、Bilibili、36kr 等中文源。
      </p>

      <h2>为什么做</h2>
      <p>
        以前我每天早上要开 8 个标签页:HN、Reddit、微博、知乎、BBC、路透、GitHub Trending、Product Hunt。同一条新闻常在两三个源里同时上榜,但角度完全不一样——HN 说是「内部文件泄露」,微博说是「战略性官宣」。手工交叉验证哪个版本更接近真相,半杯咖啡的时间就过去了。**TideNow 让我不用再做这件事**。
      </p>

      <h2>它跟别的聚合站不一样在哪</h2>
      <p>
        顶部的「多源热议」面板不是简单列表——它对所有标题做并查集聚类 + 词根处理,**5 分钟内同时在路透和微博上榜的同一条新闻**会被合并成一个 cluster,带上两个源的徽章。你能一眼看出哪条是真正跨文化的现象(很少),哪条只是某地区编辑的选题。
      </p>
      <p>
        <Link href="/zh/compose">{" "}/compose</Link>
        {" "}是 AI 协作写稿工具:选 1-5 条热点、用**你自己的** AI key(无 SaaS 加价)生成草稿、双栏 markdown 编辑、导出可发布的{" "}<code>.md</code>{" "}文件。已发布的编辑文章在
        <Link href="/zh/posts">{" "}/posts</Link>。
      </p>

      <h2>技术栈</h2>
      <ul>
        <li><a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">Next.js 16</a>(App Router + Turbopack)</li>
        <li><a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer">Tailwind CSS v4</a></li>
        <li><a href="https://next-intl.dev" target="_blank" rel="noopener noreferrer">next-intl</a> 双语</li>
        <li><a href="https://github.com/WiseLibs/better-sqlite3" target="_blank" rel="noopener noreferrer">better-sqlite3</a> 做源缓存 + AI 摘要 memoization</li>
        <li>部署 <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">Vercel</a>,DNS Cloudflare</li>
      </ul>

      <h2>它是开源的</h2>
      <p>
        完整源码 MIT 开放:
        <a href="https://github.com/Alex92908/tidenow-web" target="_blank" rel="noopener noreferrer">
          {" "}github.com/Alex92908/tidenow-web
        </a>。欢迎 PR——特别是新源、上游 API 改动后的抓取修复、翻译改进。
      </p>

      <h2>谁做的</h2>
      <p>
        独立开发者 Alex,坐标中国。副业项目,主要利用晚上和周末的时间。联系方式:
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>
        {" "}或加入 Discord:
        <a href="https://discord.gg/chjPuC963T" target="_blank" rel="noopener noreferrer">
          {" "}discord.gg/chjPuC963T
        </a>。
      </p>
    </article>
  )
}
