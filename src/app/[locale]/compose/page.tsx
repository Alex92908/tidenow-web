import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ComposeApp } from "@/components/ComposeApp"
import { getStale } from "@/lib/cache"
import { SOURCE_IDS } from "@/sources/metadata"
import type { NewsItem } from "@/lib/types"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

// Match the home page ISR cadence — the topic picker reads the same cache.
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const title = locale === "zh" ? "✍️ 写文章 | TideNow" : "✍️ Compose | TideNow"
  const description =
    locale === "zh"
      ? "从今日热点中选 1-5 条素材，AI 一键生成文章草稿，自由编辑后导出到公众号 / 头条 / 任意平台。"
      : "Pick 1–5 trending items, get an AI-generated draft, edit freely, and export to any platform."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/compose` : `${SITE_URL}/compose`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/compose`,
        "zh-Hans": `${SITE_URL}/zh/compose`,
        "x-default": `${SITE_URL}/compose`,
      },
    },
    openGraph: { type: "website", url: canonical, title, description },
    // Personal scratchpad — no value indexing this.
    robots: { index: false, follow: false },
  }
}

export default async function ComposePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const tSources = await getTranslations({ locale, namespace: "sources" })
  const tCompose = await getTranslations({ locale, namespace: "compose" })

  // Reuse the same cache the home page reads — same 5-min ISR, no extra
  // upstream load.
  const initialData: Record<string, { items: NewsItem[]; updatedAt: number }> = {}
  const sourceNames: Record<string, string> = {}
  for (const id of SOURCE_IDS) {
    const cached = getStale(id)
    if (cached && cached.items.length > 0) {
      initialData[id] = { items: cached.items, updatedAt: cached.updatedAt }
    }
    try {
      sourceNames[id] = tSources(id)
    } catch {
      sourceNames[id] = id
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f]">
      {/* Page title row — the persistent SiteNav in layout.tsx is the
          sticky bar now; this is just the page heading. */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-5 pb-1 flex items-baseline gap-3 flex-wrap">
        <h1 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
          ✍️ {tCompose("title")}
        </h1>
        <p className="hidden md:block text-xs text-gray-400 dark:text-zinc-500">
          {tCompose("subtitle")}
        </p>
      </div>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
        <ComposeApp locale={locale === "zh" ? "zh" : "en"} initialData={initialData} sourceNames={sourceNames} />
      </main>
    </div>
  )
}
