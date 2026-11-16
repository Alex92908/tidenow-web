import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getDailyDigests, type Post } from "@/lib/posts"
import { coverGradientFor } from "@/lib/post-cover"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

// Digest posts ship via git commit (the daily-digest cron), so a fresh
// build always picks them up. Daily revalidate is enough — nothing here
// changes without a deploy.
export const revalidate = 86400

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const title = locale === "zh" ? "往期日报 | TideNow" : "Daily digest archive | TideNow"
  const description =
    locale === "zh"
      ? "TideNow 每日热点日报存档 —— 每天一篇跨源热点综述，最新在前。"
      : "Archive of TideNow's daily hot-topics roundups — one per day, newest first."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/posts/daily` : `${SITE_URL}/posts/daily`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/posts/daily`,
        "zh-Hans": `${SITE_URL}/zh/posts/daily`,
        "x-default": `${SITE_URL}/posts/daily`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
    },
  }
}

function monthLabel(ym: string, lang: "en" | "zh"): string {
  const [y, m] = ym.split("-").map(Number)
  if (lang === "zh") return `${y}年${m}月`
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function dayLabel(date: string, lang: "en" | "zh"): string {
  const [, m, d] = date.split("-").map(Number)
  if (lang === "zh") return `${m}月${d}日`
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export default async function DailyArchivePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const lang: "en" | "zh" = locale === "zh" ? "zh" : "en"
  const digests = getDailyDigests(lang)
  const tPosts = await getTranslations({ locale, namespace: "posts" })

  // Group by month, newest month first (digests are already newest-first).
  const months: { ym: string; posts: Post[] }[] = []
  for (const p of digests) {
    const ym = p.date.slice(0, 7)
    const last = months[months.length - 1]
    if (last && last.ym === ym) last.posts.push(p)
    else months.push({ ym, posts: [p] })
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: lang === "zh" ? "往期日报 · TideNow" : "Daily digest archive · TideNow",
    url: lang === "zh" ? `${SITE_URL}/zh/posts/daily` : `${SITE_URL}/posts/daily`,
    inLanguage: lang === "zh" ? "zh-Hans" : "en",
    mainEntity: {
      "@type": "Blog",
      blogPost: digests.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        url: lang === "zh" ? `${SITE_URL}/zh/posts/${p.slug}` : `${SITE_URL}/posts/${p.slug}`,
        datePublished: p.date,
        author: p.author ? { "@type": "Person", name: p.author } : undefined,
      })),
    },
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-4 flex items-center gap-2">
        <Link
          href={lang === "zh" ? "/zh" : "/"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          ← TideNow
        </Link>
        <span>·</span>
        <Link
          href={lang === "zh" ? "/zh/posts" : "/posts"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          {tPosts("title")}
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 mb-2">
        📅 {tPosts("dailyArchiveTitle")}
      </h1>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-10 leading-relaxed">
        {tPosts("dailyArchiveSubtitle")}
      </p>

      {digests.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-600 italic py-12 text-center">
          {tPosts("dailyArchiveEmpty")}
        </p>
      ) : (
        months.map(({ ym, posts }) => (
          <section key={ym} className="mb-10">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-zinc-500 mb-4">
              {monthLabel(ym, lang)}
            </h2>
            <div className="space-y-3">
              {posts.map((p) => (
                <Link
                  key={p.slug}
                  href={lang === "zh" ? `/zh/posts/${p.slug}` : `/posts/${p.slug}`}
                  className="group flex gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/80 p-4 shadow-sm hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-black/40 hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-white/10 transition-all duration-200"
                >
                  {/* Date badge — pale tint in the post-cover language, dark text */}
                  <div
                    className={`shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${coverGradientFor(p.slug)} flex flex-col items-center justify-center text-slate-800 border border-black/5`}
                  >
                    <span className="text-lg font-bold leading-none">{p.date.slice(8, 10)}</span>
                    <span className="text-[10px] font-medium opacity-80 mt-0.5">
                      {p.date.slice(0, 7)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug text-gray-900 dark:text-zinc-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-2">
                      {p.title}
                    </h3>
                    {p.description && (
                      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed line-clamp-2 mt-1">
                        {p.description}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-2">
                      {dayLabel(p.date, lang)}
                      {p.author && <> · {p.author}</>}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
