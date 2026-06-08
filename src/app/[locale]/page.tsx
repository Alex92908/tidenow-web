import { getTranslations } from "next-intl/server"
import { LocaleSwitch } from "@/components/LocaleSwitch"
import { ThemeToggle } from "@/components/ThemeToggle"
import { AISettingsButton } from "@/components/AISettingsButton"
import { FilterSettingsButton } from "@/components/FilterSettingsButton"
import { FontSizeControl } from "@/components/FontSizeControl"
import { TideApp } from "@/components/TideApp"
import { getStale } from "@/lib/cache"
import { SOURCE_IDS } from "@/sources/metadata"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"
const FEEDBACK_EMAIL = "alex.chu0206@gmail.com"

// ISR: revalidate every 5 minutes so crawlers always get fresh content
export const revalidate = 300

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "site" })
  const tFooter = await getTranslations({ locale, namespace: "footer" })
  const siteUrl = locale === "zh" ? `${SITE_URL}/zh` : SITE_URL
  const feedbackHref = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    tFooter("feedbackSubject")
  )}&body=${encodeURIComponent(tFooter("feedbackBody"))}`

  // Read cached data server-side so crawlers get full content in the HTML
  const initialData: Record<string, { items: import("@/lib/types").NewsItem[]; updatedAt: number }> = {}
  for (const id of SOURCE_IDS) {
    const cached = getStale(id)
    if (cached && cached.items.length > 0) {
      initialData[id] = { items: cached.items, updatedAt: cached.updatedAt }
    }
  }

  // Two JSON-LD blobs in a @graph: a WebSite (for SearchAction) plus a
  // CollectionPage that exposes the source list as an ItemList. AI assistants
  // and modern search engines parse structured data when answering "what is
  // this site / what data does it have"; the CollectionPage tells them the
  // page is a curated set of items, not a single article.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
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
      },
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}#collection`,
        name: t("title"),
        description: t("description"),
        url: siteUrl,
        inLanguage: locale === "zh" ? "zh-Hans" : "en",
        isPartOf: { "@id": `${siteUrl}#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: SOURCE_IDS.length,
          itemListElement: SOURCE_IDS.map((id, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: locale === "zh" ? `${SITE_URL}/zh/source/${id}` : `${SITE_URL}/source/${id}`,
            name: id,
          })),
        },
      },
    ],
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
            <a
              href={locale === "zh" ? "/zh/compose" : "/compose"}
              title={locale === "zh" ? "用 AI 写文章" : "Write with AI"}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
            >
              <span className="text-sm leading-none">✍️</span>
              <span className="hidden sm:inline">{locale === "zh" ? "写文章" : "Write"}</span>
            </a>
            <a
              href={feedbackHref}
              title={tFooter("feedback")}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
            >
              <span className="text-sm leading-none">💬</span>
              <span>{tFooter("feedback")}</span>
            </a>
            <FontSizeControl />
            <AISettingsButton locale={locale} />
            <FilterSettingsButton locale={locale} />
            <ThemeToggle />
            <LocaleSwitch />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        <TideApp locale={locale} initialData={initialData} />
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-8 text-gray-400 dark:text-zinc-700 text-xs tracking-wide">
        <span>TideNow · {new Date().getFullYear()}</span>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href={locale === "zh" ? "/zh/posts" : "/posts"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          {tFooter("posts")}
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href={locale === "zh" ? "/zh/about" : "/about"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          {tFooter("about")}
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href={locale === "zh" ? "/zh/privacy" : "/privacy"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          {tFooter("privacy")}
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href={locale === "zh" ? "/zh/contact" : "/contact"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          {tFooter("contact")}
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href={locale === "zh" ? "/zh/changelog" : "/changelog"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          {tFooter("changelog")}
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href="https://discord.gg/chjPuC963T"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
          title="Discord community"
        >
          <svg
            className="w-3 h-3 fill-current"
            viewBox="0 0 16 16"
            aria-hidden
          >
            <path d="M13.55 3.07A12.93 12.93 0 0010.34 2c-.15.27-.32.63-.43.92a12.04 12.04 0 00-3.82 0c-.12-.29-.29-.65-.44-.92-1.13.2-2.21.55-3.21 1.07C.42 5.85-.13 8.55.14 11.22a13.02 13.02 0 003.93 1.98c.32-.43.6-.89.85-1.36-.47-.18-.91-.4-1.34-.65.11-.08.23-.17.34-.26 2.6 1.21 5.4 1.21 7.97 0 .11.09.22.18.34.26-.43.26-.88.47-1.34.65.24.47.53.93.85 1.36a13 13 0 003.93-1.98c.32-3.1-.55-5.77-2.31-8.15zM5.34 9.6c-.77 0-1.4-.71-1.4-1.58 0-.87.61-1.58 1.4-1.58.78 0 1.41.71 1.4 1.58 0 .87-.61 1.58-1.4 1.58zm5.18 0c-.77 0-1.4-.71-1.4-1.58 0-.87.61-1.58 1.4-1.58.78 0 1.41.71 1.4 1.58 0 .87-.6 1.58-1.4 1.58z" />
          </svg>
          <span>Discord</span>
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href="https://github.com/Alex92908/tidenow-web"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
          title="GitHub"
        >
          <svg
            className="w-3 h-3 fill-current"
            viewBox="0 0 16 16"
            aria-hidden
          >
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>GitHub</span>
        </a>
      </footer>
    </div>
  )
}
