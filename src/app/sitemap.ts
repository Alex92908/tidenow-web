import type { MetadataRoute } from "next"
import { SOURCE_IDS } from "@/sources/metadata"

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

  const sourcePages: MetadataRoute.Sitemap = SOURCE_IDS.flatMap((id) => {
    const enUrl = `${SITE_URL}/source/${id}`
    const zhUrl = `${SITE_URL}/zh/source/${id}`
    const alts = {
      languages: {
        en: enUrl,
        "zh-Hans": zhUrl,
      },
    }
    return [
      {
        url: enUrl,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: 0.7,
        alternates: alts,
      },
      {
        url: zhUrl,
        lastModified: now,
        changeFrequency: "hourly" as const,
        priority: 0.7,
        alternates: alts,
      },
    ]
  })

  return [...homepages, ...sourcePages]
}
