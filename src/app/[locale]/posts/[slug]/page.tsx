import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/posts"
import { HERO_GRADIENT } from "@/lib/post-cover"
import { TranslateToggle } from "@/components/posts/TranslateToggle"
import { ReadingProgress } from "@/components/posts/ReadingProgress"
import { ShareBar } from "@/components/posts/ShareBar"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export const revalidate = 86400

export async function generateStaticParams() {
  // Build every (locale × slug) at build time so /posts/[slug] is pure
  // static HTML. Posts live in git, so the set is fixed per deploy.
  return getAllPosts().flatMap((p) =>
    ["en", "zh"].map((locale) => ({ locale, slug: p.slug }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  const canonical =
    post.locale === "zh"
      ? `${SITE_URL}/zh/posts/${post.slug}`
      : `${SITE_URL}/posts/${post.slug}`

  // We canonicalize a post to ITS authored locale, not the requesting
  // locale — a Chinese post served under /posts/[slug] should still
  // canonical to /zh/posts/[slug] so search engines don't index it twice.
  return {
    title: `${post.title} | TideNow`,
    description: post.description || post.body.slice(0, 160),
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
      tags: post.tags,
      images: post.cover ? [{ url: post.cover }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.cover ? [post.cover] : undefined,
    },
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const lang: "en" | "zh" = locale === "zh" ? "zh" : "en"
  const tPosts = await getTranslations({ locale, namespace: "posts" })
  const related = getRelatedPosts(post, 3)
  const authorName = post.author ?? "TideNow"
  const canonical =
    post.locale === "zh"
      ? `${SITE_URL}/zh/posts/${post.slug}`
      : `${SITE_URL}/posts/${post.slug}`

  // Schema.org Article: dateline + author + headline + body excerpt. This
  // is what AdSense / Google News / AI assistants read to confirm this is
  // a real editorial piece, not a thin aggregator page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: post.locale === "zh" ? "zh-Hans" : "en",
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: "TideNow" },
    publisher: {
      "@type": "Organization",
      name: "TideNow",
      url: SITE_URL,
    },
    image: post.cover,
    keywords: post.tags?.join(", "),
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <ReadingProgress />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero — pale tint (lee: no dark backgrounds), dark ink text.
          Author cover image underneath at low opacity when present. */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${HERO_GRADIENT} px-6 py-8 sm:px-10 sm:py-10 mb-8 border border-black/5`}
      >
        {post.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        )}
        <div className="relative">
          <nav className="text-xs text-slate-500 mb-6">
            <Link
              href={lang === "zh" ? "/zh/posts" : "/posts"}
              className="hover:text-slate-900 transition-colors"
            >
              ← {lang === "zh" ? "全部文章" : "All posts"}
            </Link>
          </nav>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full bg-white/80 text-[11px] font-medium text-slate-700 border border-black/5 backdrop-blur"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight break-words">
            {post.title}
          </h1>
          {post.description && (
            <p className="text-base text-slate-600 mt-3 leading-relaxed">
              {post.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-5 text-xs text-slate-500">
            <time dateTime={post.date}>{post.date}</time>
            {post.author && (
              <>
                <span>·</span>
                <span>{post.author}</span>
              </>
            )}
            <span>·</span>
            <span className="font-bold tracking-widest text-slate-900/30 text-[10px]">
              TIDENOW
            </span>
          </div>
        </div>
      </section>

      {/* Body */}
      <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500 prose-img:rounded-lg">
        <TranslateToggle
          slug={post.slug}
          postLocale={post.locale}
          uiLocale={lang}
          body={post.body}
        />
      </article>

      {/* Share */}
      <div className="mt-10 pt-6 border-t border-gray-100 dark:border-white/[0.04]">
        <ShareBar title={post.title} url={canonical} locale={lang} />
      </div>

      {/* Related posts — same locale, overlapping tags first, then newest. */}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-zinc-100 mb-4">
            {tPosts("related")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={lang === "zh" ? `/zh/posts/${r.slug}` : `/posts/${r.slug}`}
                className="group block rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/80 p-4 shadow-sm hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-black/40 hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-white/10 transition-all duration-200"
              >
                {r.tags && r.tags.length > 0 && (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[11px] text-gray-500 dark:text-zinc-400 mb-2">
                    {r.tags[0]}
                  </span>
                )}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-sky-500 transition-colors leading-snug line-clamp-3">
                  {r.title}
                </h3>
                <time
                  dateTime={r.date}
                  className="block mt-2 text-[11px] text-gray-400 dark:text-zinc-600"
                >
                  {r.date}
                </time>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Author card */}
      <section className="mt-10 flex items-start gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/80 p-5 shadow-sm">
        <span
          aria-hidden
          className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white"
        >
          {authorName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {authorName}
          </p>
          <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            {tPosts("authorBio")}
          </p>
          <Link
            href={lang === "zh" ? "/zh/posts" : "/posts"}
            className="inline-block mt-2 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
          >
            {tPosts("moreFrom")}
          </Link>
        </div>
      </section>

      {/* CTA: back to home */}
      <div className="mt-12 pt-6 border-t border-gray-100 dark:border-white/[0.04] text-center">
        <Link
          href={lang === "zh" ? "/zh" : "/"}
          className="text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 underline underline-offset-4"
        >
          {lang === "zh" ? "回到 TideNow 主页" : "Back to TideNow"}
        </Link>
      </div>
    </main>
  )
}
