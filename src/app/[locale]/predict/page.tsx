import type { Metadata } from "next"
import Link from "next/link"
import { PredictApp } from "@/components/PredictApp"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const title = locale === "zh" ? "🔮 ForeSight 预测 | TideNow" : "🔮 ForeSight Predict | TideNow"
  const description =
    locale === "zh"
      ? "描述一个未来事件,ForeSight 自动路由到对应方法论(情景树/舆情仿真/基率锚定/区间预测等),给出校准概率与分析。"
      : "Describe a future event. ForeSight routes it to the right methodology (scenario trees, opinion simulation, base-rate anchoring, interval forecasts) and returns a calibrated probability with analysis."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/predict` : `${SITE_URL}/predict`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/predict`,
        "zh-Hans": `${SITE_URL}/zh/predict`,
        "x-default": `${SITE_URL}/predict`,
      },
    },
    openGraph: { type: "website", url: canonical, title, description },
    // Personal scratchpad-ish — predictions are user-driven, not indexable
    // content. Keep it out of search results.
    robots: { index: false, follow: false },
  }
}

export default async function PredictPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const lang: "en" | "zh" = locale === "zh" ? "zh" : "en"

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-6">
        <Link
          href={lang === "zh" ? "/zh" : "/"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          ← TideNow
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 mb-2">
        🔮 {lang === "zh" ? "ForeSight 预测" : "ForeSight Predict"}
      </h1>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8 leading-relaxed">
        {lang === "zh"
          ? "输入一个未来事件,系统自动选择方法论(情景树 / 舆情仿真 / 基率锚定 / 区间预测…)给出校准概率。用你自己的 AI key,概率仅供参考。"
          : "Enter a future event. The engine picks a methodology (scenario trees / opinion simulation / base-rate anchoring / interval forecasts…) and returns a calibrated probability. Uses your own AI key; the number is for reference."}
      </p>

      <PredictApp locale={lang} />
    </main>
  )
}
