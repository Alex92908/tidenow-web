import type { Metadata } from "next"
import Link from "next/link"
import { RELEASES, type ChangeKind } from "@/data/changelog"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export const revalidate = 86400 // 24h — releases don't change mid-day

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const title = locale === "zh" ? "更新日志 | TideNow" : "Changelog | TideNow"
  const description =
    locale === "zh"
      ? "TideNow 历次版本更新内容。"
      : "What's new in TideNow — every release, every change."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/changelog` : `${SITE_URL}/changelog`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/changelog`,
        "zh-Hans": `${SITE_URL}/zh/changelog`,
        "x-default": `${SITE_URL}/changelog`,
      },
    },
    openGraph: { type: "article", url: canonical, title, description },
  }
}

const KIND_LABEL: Record<ChangeKind, { en: string; zh: string; className: string }> = {
  feat: {
    en: "Feature",
    zh: "新增",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  fix: {
    en: "Fix",
    zh: "修复",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  polish: {
    en: "Polish",
    zh: "优化",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  infra: {
    en: "Infra",
    zh: "基建",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const isZh = locale === "zh"
  const homeHref = isZh ? "/zh" : "/"

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      {/* Back link */}
      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-6">
        <Link href={homeHref} className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">
          ← TideNow
        </Link>
      </nav>

      {/* Page heading */}
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
          {isZh ? "更新日志" : "Changelog"}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
          {isZh
            ? "每次发布都记一下，让你知道我们最近改了什么。"
            : "Every release, with notes — so you know what changed."}
        </p>
      </header>

      {/* Releases timeline */}
      <div className="space-y-12">
        {RELEASES.map((release) => (
          <article key={release.version} className="relative">
            {/* Version + date row */}
            <div className="flex items-baseline gap-3 mb-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-zinc-100 tabular-nums">
                v{release.version}
              </h2>
              <time
                dateTime={release.date}
                className="text-[12px] text-gray-400 dark:text-zinc-600 tabular-nums"
              >
                {release.date}
              </time>
            </div>
            {/* Release title */}
            <p className="text-base text-gray-700 dark:text-zinc-300 mb-4">
              {isZh ? release.title.zh : release.title.en}
            </p>
            {/* Change list */}
            <ul className="space-y-3 pl-0">
              {release.changes.map((change, i) => {
                const label = KIND_LABEL[change.kind]
                return (
                  <li
                    key={i}
                    className="flex items-start gap-3 leading-relaxed text-[14px] text-gray-600 dark:text-zinc-300"
                  >
                    <span
                      className={`shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${label.className}`}
                    >
                      {isZh ? label.zh : label.en}
                    </span>
                    <span className="flex-1 min-w-0">{isZh ? change.zh : change.en}</span>
                  </li>
                )
              })}
            </ul>
          </article>
        ))}
      </div>

      {/* Tail CTA */}
      <div className="mt-16 text-center text-xs text-gray-400 dark:text-zinc-600">
        <Link
          href={homeHref}
          className="underline underline-offset-4 hover:text-gray-700 dark:hover:text-zinc-300"
        >
          {isZh ? "返回首页" : "Back to home"}
        </Link>
      </div>
    </main>
  )
}
