import { getTranslations } from "next-intl/server"
import { LocaleSwitch } from "@/components/LocaleSwitch"
import { ThemeToggle } from "@/components/ThemeToggle"
import { TideApp } from "@/components/TideApp"
import { getStale } from "@/lib/cache"
import { SOURCE_IDS } from "@/sources/metadata"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tidenow.app"

// ISR: revalidate every 5 minutes so crawlers always get fresh content
export const revalidate = 300

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "site" })
  const siteUrl = locale === "zh" ? `${SITE_URL}/zh` : SITE_URL

  // Read cached data server-side so crawlers get full content in the HTML
  const initialData: Record<string, { items: import("@/lib/types").NewsItem[]; updatedAt: number }> = {}
  for (const id of SOURCE_IDS) {
    const cached = getStale(id)
    if (cached && cached.items.length > 0) {
      initialData[id] = { items: cached.items, updatedAt: cached.updatedAt }
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t("title"),
    description: t("description"),
    url: siteUrl,
    inLanguage: locale === "zh" ? "zh-Hans" : "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Ambient gradient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/8 dark:bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-400/6 dark:bg-purple-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 w-64 h-64 bg-cyan-400/5 dark:bg-cyan-500/6 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center shrink-0 select-none">
            <span
              className="text-[1.35rem] font-bold text-gray-900 dark:text-white tracking-tight leading-none"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Tide
            </span>
            <span
              className="text-[1.35rem] font-normal text-sky-500 dark:text-sky-400 tracking-tight leading-none"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Now
            </span>
          </div>

          {/* Tagline */}
          <p className="hidden md:block text-xs text-gray-400 dark:text-zinc-500 truncate">
            {t("description")}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <LocaleSwitch />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <TideApp locale={locale} initialData={initialData} />
      </main>

      <footer className="text-center py-8 text-gray-300 dark:text-zinc-700 text-xs tracking-wide">
        TideNow · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
