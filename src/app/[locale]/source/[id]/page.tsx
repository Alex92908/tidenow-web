import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ShareButton } from "@/components/ShareButton"
import { getStale } from "@/lib/cache"
import { sourceMeta, SOURCE_IDS } from "@/sources/metadata"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

// Re-build at most every 5 minutes (matches home ISR cadence)
export const revalidate = 300

export async function generateStaticParams() {
  const locales = ["en", "zh"]
  return locales.flatMap((locale) =>
    SOURCE_IDS.map((id) => ({ locale, id }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params
  if (!sourceMeta[id]) return {}
  const tSources = await getTranslations({ locale, namespace: "sources" })
  const tSite = await getTranslations({ locale, namespace: "site" })
  const sourceName = tSources(id)
  const title = locale === "zh" ? `${sourceName} - 实时热榜 | TideNow` : `${sourceName} - Live Trending | TideNow`
  const description =
    locale === "zh"
      ? `${sourceName} 最新实时热榜，与 ${tSite("title")} 上 50+ 信息源同步聚合。`
      : `Live ${sourceName} trending list, aggregated alongside 50+ other sources on ${tSite("title")}.`
  const canonical = locale === "zh" ? `${SITE_URL}/zh/source/${id}` : `${SITE_URL}/source/${id}`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/source/${id}`,
        "zh-Hans": `${SITE_URL}/zh/source/${id}`,
        "x-default": `${SITE_URL}/source/${id}`,
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

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const meta = sourceMeta[id]
  if (!meta) notFound()

  const tSources = await getTranslations({ locale, namespace: "sources" })
  const sourceName = tSources(id)
  const cached = getStale(id)
  const items = cached?.items ?? []

  const homeHref = locale === "zh" ? `/zh#source-card-${id}` : `/#source-card-${id}`
  const lastUpdatedText =
    cached?.updatedAt && cached.updatedAt > 0
      ? new Date(cached.updatedAt).toISOString()
      : null

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Back link */}
      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-4">
        <Link href={locale === "zh" ? "/zh" : "/"} className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">
          ← TideNow
        </Link>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl leading-none">{meta.icon}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
          {sourceName}
        </h1>
      </div>
      <div className={`h-0.5 w-12 rounded ${meta.accentColor} mb-6`} />

      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8 leading-relaxed">
        {locale === "zh"
          ? `${sourceName} 最新实时热榜。下方为最近一次抓取的 Top ${Math.min(items.length, meta.expandCount)} 条。`
          : `Live trending from ${sourceName}. Below are the top ${Math.min(items.length, meta.expandCount)} items from the latest fetch.`}
        {lastUpdatedText && (
          <>
            <br />
            <span className="text-xs text-gray-400 dark:text-zinc-600">
              {locale === "zh" ? "上次更新：" : "Last updated: "}
              <time dateTime={lastUpdatedText}>{lastUpdatedText}</time>
            </span>
          </>
        )}
      </p>

      {/* Items */}
      <ol className="flex flex-col rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900/80 divide-y divide-gray-100 dark:divide-white/[0.04] overflow-hidden">
        {items.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">
            {locale === "zh" ? "暂无缓存数据，请回主页加载。" : "No cached data yet — load it from the home page."}
          </li>
        ) : (
          items.slice(0, meta.expandCount).map((item, i) => {
            const rank = i + 1
            const isTop3 = rank <= 3
            return (
              <li key={item.id} className="flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-2.5 flex-1 min-w-0 items-start"
                >
                  <span
                    className={`text-[11px] font-mono w-5 shrink-0 mt-0.5 text-right font-bold ${
                      isTop3 ? "text-orange-400" : "text-gray-300 dark:text-zinc-700"
                    }`}
                  >
                    {rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-zinc-200 group-hover:text-gray-900 dark:group-hover:text-zinc-100 leading-snug transition-colors">
                      {item.title}
                    </p>
                    {item.extra && (
                      <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-0.5 truncate">{item.extra}</p>
                    )}
                  </div>
                </a>
                <ShareButton item={item} />
              </li>
            )
          })
        )}
      </ol>

      {/* CTA back to home with this source anchored */}
      <div className="mt-8 text-center">
        <Link
          href={homeHref}
          className="inline-block text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 underline underline-offset-4"
        >
          {locale === "zh" ? "在 TideNow 主页查看此源" : "View this source on TideNow"}
        </Link>
      </div>
    </main>
  )
}
