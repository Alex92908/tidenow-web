"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getAISettings } from "@/lib/ai-settings"

interface PredictResult {
  domain: string
  reason: string
  question: string
  probability: number | null
  markdown: string
}

interface Props {
  locale: "en" | "zh"
}

// Domain options mirror ForeSight's router. "auto" lets the engine
// classify; the rest let a user force a methodology.
// 'market' is intentionally omitted — its quant backend needs a live
// price feed (akshare / CSV) that this deployment doesn't have, so it
// always errors. Auto-routing to market is caught server-side and redone
// as scenario; users just can't pick it directly.
const DOMAINS: { id: string; en: string; zh: string }[] = [
  { id: "auto", en: "Auto", zh: "自动" },
  { id: "opinion", en: "Opinion / buzz", zh: "舆情/口碑" },
  { id: "scenario", en: "Geopolitics / tech", zh: "军事/外交/科技" },
  { id: "sports", en: "Sports", zh: "体育/电竞" },
  { id: "macro", en: "Macro", zh: "宏观经济" },
  { id: "trend", en: "Consumer trend", zh: "消费趋势" },
  { id: "election", en: "Elections", zh: "选举" },
  { id: "boxoffice", en: "Box office", zh: "影视票房" },
  { id: "nature", en: "Weather / nature", zh: "天气/自然" },
]

// Domain → display label + accent. Keeps the result badge readable.
const DOMAIN_LABEL: Record<string, { en: string; zh: string }> = Object.fromEntries(
  DOMAINS.filter((d) => d.id !== "auto").map((d) => [d.id, { en: d.en, zh: d.zh }])
)

export function PredictApp({ locale }: Props) {
  const [seed, setSeed] = useState("")
  const [domain, setDomain] = useState("auto")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictResult | null>(null)

  const isZh = locale === "zh"
  const t = (zh: string, en: string) => (isZh ? zh : en)

  async function handlePredict() {
    const trimmed = seed.trim()
    if (!trimmed) return
    setError(null)

    const settings = getAISettings()
    if (!settings?.provider || !settings?.apiKey) {
      setError(
        t(
          "请先在主页右上角 ✦ 按钮里设置 AI key。",
          "Set an AI key first via the ✦ button in the home page header."
        )
      )
      return
    }
    if (settings.provider === "gemini" || settings.provider === "gemini-nano") {
      setError(
        t(
          "ForeSight 需要 OpenAI/Anthropic 兼容的云端 provider(DeepSeek/OpenAI/Anthropic/智谱)。Gemini 与本地 Nano 不支持。",
          "ForeSight needs a DeepSeek / OpenAI / Anthropic / Zhipu key. Gemini and on-device Nano aren't supported."
        )
      )
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/foresight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.apiKey,
          seed: trimmed,
          domain,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setResult(data as PredictResult)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const pct = result?.probability != null ? Math.round(result.probability * 100) : null
  const domainLabel =
    result && DOMAIN_LABEL[result.domain]
      ? isZh
        ? DOMAIN_LABEL[result.domain].zh
        : DOMAIN_LABEL[result.domain].en
      : result?.domain

  return (
    <div className="space-y-4">
      {/* Input */}
      <textarea
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        placeholder={t(
          "描述一个未来事件，例如：美伊关系未来 60 天是否会升级？特斯拉下季度交付量会创新高吗？",
          "Describe a future event, e.g. Will US-Iran tensions escalate in the next 60 days? Will Tesla set a delivery record next quarter?"
        )}
        rows={3}
        className="w-full resize-y rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
      />

      {/* Domain picker + predict button */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-2.5 py-1.5 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          {DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>
              {isZh ? d.zh : d.en}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handlePredict}
          disabled={!seed.trim() || loading}
          className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? t("🔮 预测中…", "🔮 Predicting…") : t("🔮 预测", "🔮 Predict")}
        </button>
        {loading && (
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            {t("情景推演可能需要 20-40 秒", "Scenario reasoning takes 20-40s")}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 leading-snug">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
          {/* Domain + probability header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              🔮 {domainLabel}
            </span>
            {pct != null ? (
              <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-100">
                {pct}
                <span className="text-sm font-normal text-gray-400 dark:text-zinc-500 ml-0.5">%</span>
              </span>
            ) : (
              <span className="text-[11px] text-gray-400 dark:text-zinc-600">
                {t("该领域不输出概率", "no probability for this domain")}
              </span>
            )}
          </div>

          {/* Probability bar */}
          {pct != null && (
            <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* Core question */}
          {result.question && (
            <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">
              {result.question}
            </p>
          )}

          {/* Full report */}
          <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500 border-t border-gray-100 dark:border-white/[0.04] pt-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
          </article>

          {/* Honest disclaimer */}
          <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed border-t border-gray-100 dark:border-white/[0.04] pt-3">
            {t(
              "ForeSight 用领域路由 + 超级预测方法论给出校准概率,仅供参考,不构成任何投资/决策建议。",
              "ForeSight routes by domain and applies superforecasting methodology to produce a calibrated probability. For reference only — not investment or decision advice."
            )}
          </p>
        </div>
      )}
    </div>
  )
}
