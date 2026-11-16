import type { MetadataRoute } from "next"
import { getAllPosts } from "@/lib/posts"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const homepages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
      alternates: {
        languages: {
          "zh-Hans": `${SITE_URL}/zh`,
          en: SITE_URL,
        },
      },
    },
    {
      url: `${SITE_URL}/zh`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: {
        languages: {
          "zh-Hans": `${SITE_URL}/zh`,
          en: SITE_URL,
        },
      },
    },
  ]

  // Per-source pages are NOT in the sitemap. They are headline lists with
  // no original text (see the noindex on the /source page metadata) — the
  // transformation's indexed surface is the homepage + /posts. Visitors
  // still reach every source from the homepage and the nav.
  const changelogPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/changelog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: {
          en: `${SITE_URL}/changelog`,
          "zh-Hans": `${SITE_URL}/zh/changelog`,
        },
      },
    },
    {
      url: `${SITE_URL}/zh/changelog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: {
          en: `${SITE_URL}/changelog`,
          "zh-Hans": `${SITE_URL}/zh/changelog`,
        },
      },
    },
  ]

  // Posts listing pages (en + zh) + every individual post URL. Posts use
  // their authored locale's URL as canonical (see /posts/[slug] metadata)
  // so we list each post once, under its authored locale.
  const postsIndexes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/posts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${SITE_URL}/posts`,
          "zh-Hans": `${SITE_URL}/zh/posts`,
        },
      },
    },
    {
      url: `${SITE_URL}/zh/posts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: {
        languages: {
          en: `${SITE_URL}/posts`,
          "zh-Hans": `${SITE_URL}/zh/posts`,
        },
      },
    },
  ]

  const postPages: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url:
      p.locale === "zh"
        ? `${SITE_URL}/zh/posts/${p.slug}`
        : `${SITE_URL}/posts/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }))

  // Trust / legal pages — required for AdSense, also useful credibility
  // signals for any reviewer or new visitor.
  const trustSlugs = ["privacy", "about", "contact", "editorial"] as const
  const trustPages: MetadataRoute.Sitemap = trustSlugs.flatMap((slug) => [
    {
      url: `${SITE_URL}/${slug}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.5,
      alternates: {
        languages: {
          en: `${SITE_URL}/${slug}`,
          "zh-Hans": `${SITE_URL}/zh/${slug}`,
        },
      },
    },
    {
      url: `${SITE_URL}/zh/${slug}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.5,
      alternates: {
        languages: {
          en: `${SITE_URL}/${slug}`,
          "zh-Hans": `${SITE_URL}/zh/${slug}`,
        },
      },
    },
  ])

  return [
    ...homepages,
    ...changelogPages,
    ...postsIndexes,
    ...postPages,
    ...trustPages,
  ]
}
