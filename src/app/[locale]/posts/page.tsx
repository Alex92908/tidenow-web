import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { getPostsByLocale } from "@/lib/posts"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

// Posts ship via git commit, so a fresh build always picks up new ones.
// Daily revalidate is enough for the listing — nothing here changes
// without a deploy.
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
  const title = locale === "zh" ? "文章 | TideNow" : "Posts | TideNow"
  const description =
    locale === "zh"
      ? "TideNow 主笔文章 —— 每周一篇，写跨源热点的成因、对比和趋势。"
      : "Editorial pieces from TideNow — weekly takes on cross-source trends, framing differences, and what the data actually shows."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/posts` : `${SITE_URL}/posts`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/posts`,
        "zh-Hans": `${SITE_URL}/zh/posts`,
        "x-default": `${SITE_URL}/posts`,
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

export default async function PostsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const lang: "en" | "zh" = locale === "zh" ? "zh" : "en"
  const posts = getPostsByLocale(lang)
  const tCommon = await getTranslations({ locale, namespace: "posts" })

  // JSON-LD: a CollectionPage wrapping a Blog so search engines treat
  // this as a curated set of editorial articles, not a generic listing.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: lang === "zh" ? "文章 · TideNow" : "Posts · TideNow",
    url: lang === "zh" ? `${SITE_URL}/zh/posts` : `${SITE_URL}/posts`,
    inLanguage: lang === "zh" ? "zh-Hans" : "en",
    mainEntity: {
      "@type": "Blog",
      blogPost: posts.map((p) => ({
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

      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-4">
        <Link
          href={lang === "zh" ? "/zh" : "/"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          ← TideNow
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 mb-2">
        {tCommon("title")}
      </h1>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-10 leading-relaxed">
        {tCommon("subtitle")}
      </p>

      {posts.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-600 italic py-12 text-center">
          {tCommon("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {posts.map((p) => (
            <li key={p.slug} className="border-b border-gray-100 dark:border-white/[0.04] pb-6 last:border-b-0">
              <Link
                href={lang === "zh" ? `/zh/posts/${p.slug}` : `/posts/${p.slug}`}
                className="group block"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-sky-500 transition-colors leading-snug">
                  {p.title}
                </h2>
                {p.description && (
                  <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1.5 leading-relaxed line-clamp-3">
                    {p.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 dark:text-zinc-600">
                  <time dateTime={p.date}>{p.date}</time>
                  {p.author && (
                    <>
                      <span>·</span>
                      <span>{p.author}</span>
                    </>
                  )}
                  {p.tags && p.tags.length > 0 && (
                    <>
                      <span>·</span>
                      {p.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5">
                          {t}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {/* Submission CTA — intentionally just an email line, not a form.
          A real submission queue is wonderful AdSense suicide right now;
          a "pitch me by email" line signals openness without turning the
          site into a UGC content farm in the reviewer's eyes. */}
      <section className="mt-16 pt-8 border-t border-gray-100 dark:border-white/[0.04] text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
        {lang === "zh" ? (
          <p>
            想投稿?发邮件给{" "}
            <a
              href="mailto:alex.chu0206@gmail.com?subject=TideNow%20%E6%8A%95%E7%A8%BF"
              className="text-sky-500 hover:underline"
            >
              alex.chu0206@gmail.com
            </a>
            ——每封都看。话题接近跨源热点、数据洞察、独立开发者经验、AI 工具实操都欢迎。
          </p>
        ) : (
          <p>
            Want to contribute? Email{" "}
            <a
              href="mailto:alex.chu0206@gmail.com?subject=TideNow%20pitch"
              className="text-sky-500 hover:underline"
            >
              alex.chu0206@gmail.com
            </a>
            {" "}— I review every pitch. Topics close to cross-source
            trends, data observations, indie hacking, and hands-on AI
            tooling are all welcome.
          </p>
        )}
      </section>
    </main>
  )
}
