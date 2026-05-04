import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tidenow.app"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
      alternates: {
        languages: {
          "zh-Hans": SITE_URL,
          en: `${SITE_URL}/en`,
        },
      },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
      alternates: {
        languages: {
          "zh-Hans": SITE_URL,
          en: `${SITE_URL}/en`,
        },
      },
    },
  ]
}
