import { getTranslations } from "next-intl/server"
import { TideApp } from "@/components/TideApp"
import { getStale } from "@/lib/cache"
import { SOURCE_IDS } from "@/sources/metadata"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

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

      {/* Main content — the persistent SiteNav lives in layout.tsx */}
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
          href={locale === "zh" ? "/zh/posts/daily" : "/posts/daily"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          📅 {tFooter("daily")}
        </a>
        <span className="text-gray-300 dark:text-zinc-800">·</span>
        <a
          href={locale === "zh" ? "/zh/compose" : "/compose"}
          className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
        >
          ✍️ {tFooter("write")}
        </a>
        {process.env.NEXT_PUBLIC_FORESIGHT_ENABLED !== "0" && (
          <>
            <span className="text-gray-300 dark:text-zinc-800">·</span>
            <a
              href={locale === "zh" ? "/zh/predict" : "/predict"}
              className="hover:text-gray-700 dark:hover:text-zinc-400 transition-colors underline-offset-2 hover:underline"
            >
              🔮 {tFooter("predict")}
            </a>
          </>
        )}
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
