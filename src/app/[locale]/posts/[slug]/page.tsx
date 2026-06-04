import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getAllPosts, getPostBySlug } from "@/lib/posts"

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
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-6">
        <Link
          href={lang === "zh" ? "/zh/posts" : "/posts"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          ← {lang === "zh" ? "全部文章" : "All posts"}
        </Link>
      </nav>

      {/* Title + dateline */}
      <header className="mb-8 pb-6 border-b border-gray-100 dark:border-white/[0.04]">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 leading-tight">
          {post.title}
        </h1>
        {post.description && (
          <p className="text-base text-gray-600 dark:text-zinc-400 mt-3 leading-relaxed">
            {post.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-4 text-xs text-gray-400 dark:text-zinc-600">
          <time dateTime={post.date}>{post.date}</time>
          {post.author && (
            <>
              <span>·</span>
              <span>{post.author}</span>
            </>
          )}
          {post.tags?.map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      {/* Cover */}
      {post.cover && (
        // Using a plain <img> here on purpose — covers are author-provided
        // URLs that may be off-domain, so Next/Image's loader pipeline
        // (which expects whitelisted hosts) is the wrong tool.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover}
          alt=""
          className="w-full rounded-lg mb-8 object-cover"
        />
      )}

      {/* Body */}
      <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500 prose-img:rounded-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.body}</ReactMarkdown>
      </article>

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
