import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations } from "next-intl/server"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import "./tide.css"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "site" })
  const title = t("title")
  const description = t("description")
  // English is at /, Chinese is at /zh (localePrefix: as-needed)
  const url = locale === "zh" ? `${SITE_URL}/zh` : SITE_URL

  return {
    title: { default: title, template: `%s · ${title}` },
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: url,
      languages: {
        "zh-Hans": `${SITE_URL}/zh`,
        "en": SITE_URL,
        "x-default": SITE_URL,
      },
    },
    openGraph: {
      type: "website",
      url,
      siteName: title,
      title,
      description,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      alternateLocale: locale === "zh" ? "en_US" : "zh_CN",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    verification: {
      google: "0TCc1xvtUO12tpsgdTcfCptVmLEhv9eb5CxtIB1hKqU",
    },
    other: {
      "theme-color": "#0ea5e9",
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-[#0a0a0f] text-gray-900 dark:text-zinc-100 antialiased">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2701427752265946"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
