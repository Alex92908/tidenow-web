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

type ScanKind = "zt" | "funnel"

interface ScanStock {
  code: string
  name: string
  reason?: string
  // zt
  height?: number
  price?: number | null
  industry?: string
  break_n?: number | null
  prob?: number | null
  outcome?: number | null
  // funnel
  growth?: number | null
  chg60?: number | null
  tag?: string
  why?: string
  entry_price?: number | null
  alpha?: number | null
  // shared (resolved)
  ret?: number | null
}

interface MarketScan {
  scan: ScanKind
  date: string | null
  period?: string | null
  stocks: ScanStock[]
  stale?: boolean
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
  { id: "market", en: "Stocks (A-share)", zh: "股票（A股）" },
  { id: "nature", en: "Weather / nature", zh: "天气/自然" },
  { id: "metaphysics", en: "Metaphysics / fortune", zh: "玄学/命理" },
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
  const [scan, setScan] = useState<MarketScan | null>(null)

  const isZh = locale === "zh"
  const t = (zh: string, en: string) => (isZh ? zh : en)
  const isMarket = domain === "market"

  // Read the BYOK key, surfacing the same errors for both flows.
  function readKey(): { provider: string; apiKey: string } | null {
    const settings = getAISettings()
    if (!settings?.provider || !settings?.apiKey) {
      setError(
        t(
          "请先在主页右上角 ✦ 按钮里设置 AI key。",
          "Set an AI key first via the ✦ button in the home page header."
        )
      )
      return null
    }
    if (settings.provider === "gemini" || settings.provider === "gemini-nano") {
      setError(
        t(
          "ForeSight 需要 OpenAI/Anthropic 兼容的云端 provider(DeepSeek/OpenAI/Anthropic/智谱)。Gemini 与本地 Nano 不支持。",
          "ForeSight needs a DeepSeek / OpenAI / Anthropic / Zhipu key. Gemini and on-device Nano aren't supported."
        )
      )
      return null
    }
    return { provider: settings.provider, apiKey: settings.apiKey }
  }

  async function handleScan(kind: ScanKind) {
    setError(null)
    const key = readKey()
    if (!key) return
    setLoading(true)
    setResult(null)
    setScan(null)
    try {
      const res = await fetch("/api/foresight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...key, scan: kind, top: kind === "zt" ? 10 : 12 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setScan(data as MarketScan)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePredict() {
    const trimmed = seed.trim()
    if (!trimmed) return
    setError(null)

    const key = readKey()
    if (!key) return

    setLoading(true)
    setResult(null)
    setScan(null)
    try {
      const res = await fetch("/api/foresight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: key.provider,
          apiKey: key.apiKey,
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
      {/* Input — hidden in market-scan mode, which needs no seed. */}
      {!isMarket && (
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
      )}

      {isMarket && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
          {t(
            "不用输代码,两种扫法都自动扫全市场,数据走东财/新浪,无需 akshare：",
            "No code needed — both scans sweep the whole market via eastmoney / Sina, no akshare:"
          )}
          <br />
          <span className="text-rose-600 dark:text-rose-400 font-medium">{t("🔥 打板(快钱)", "🔥 Relay (fast)")}</span>
          {t("：当日涨停池(二板及以上),给「明日再涨停」概率。", " — today's limit-up pool (2nd board+), 'limit-up again tomorrow' probability. ")}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t("🐢 漏斗(慢钱)", "🐢 Funnel (slow)")}</span>
          {t("：业绩预增+卖铲子位置的观察篮,持有 20 日对比沪深300。", " — an earnings-growth 'sell-shovels' basket, held 20 days vs CSI 300.")}
        </p>
      )}

      {/* Domain picker + action button(s) */}
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
        {isMarket ? (
          <>
            <button
              type="button"
              onClick={() => handleScan("zt")}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("🔥 扫打板", "🔥 Relay")}
            </button>
            <button
              type="button"
              onClick={() => handleScan("funnel")}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("🐢 扫漏斗", "🐢 Funnel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handlePredict}
            disabled={!seed.trim() || loading}
            className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? t("🔮 预测中…", "🔮 Predicting…") : t("🔮 预测", "🔮 Predict")}
          </button>
        )}
        {loading && (
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            {isMarket
              ? t("扫描 + 逐只打分,约 15-40 秒", "Scanning + scoring, ~15-40s")
              : t("情景推演可能需要 20-40 秒", "Scenario reasoning takes 20-40s")}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 leading-snug">{error}</p>
      )}

      {/* Market scan — a ranked table of many candidates (zt or funnel) */}
      {scan && (() => {
        const isFunnel = scan.scan === "funnel"
        const accent = isFunnel
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        return (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${accent}`}>
              {isFunnel
                ? `🐢 ${t("慢钱漏斗观察篮", "Slow-money basket")}`
                : `🔥 ${t("涨停接力候选", "Limit-up relay candidates")}`}
              {scan.date ? ` · ${scan.date}` : ""}
              {isFunnel && scan.period ? t(`（业绩期 ${scan.period}）`, ` (${scan.period})`) : ""}
            </span>
            {scan.stale && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                {t("实时抓取失败，展示台账最近一批", "live fetch failed — showing latest ledger batch")}
              </span>
            )}
          </div>

          {scan.stocks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {isFunnel
                ? t("暂无满足条件的预增标的（或非交易日）。", "No qualifying earnings-growth names (or not a trading day).")
                : t("今日涨停池暂无二板及以上标的（或非交易日）。", "No 2nd-board+ stocks in today's pool (or not a trading day).")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.06]">
                    <th className="py-1.5 pr-2 font-medium">{t("名称", "Name")}</th>
                    {isFunnel ? (
                      <>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("净利预增", "Profit growth")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("60日涨幅", "60d chg")}</th>
                        <th className="py-1.5 px-2 font-medium">{t("标签", "Tag")}</th>
                      </>
                    ) : (
                      <>
                        <th className="py-1.5 px-2 font-medium">{t("连板", "Streak")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("现价", "Price")}</th>
                        <th className="py-1.5 px-2 font-medium">{t("再板概率", "Next-day prob")}</th>
                      </>
                    )}
                    <th className="py-1.5 pl-2 font-medium">{t("理由", "Why")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.stocks.map((s) => {
                    const p = s.prob != null ? Math.round(s.prob * 100) : null
                    return (
                      <tr
                        key={s.code}
                        className="border-b border-gray-50 dark:border-white/[0.03] last:border-0 align-top"
                      >
                        <td className="py-2 pr-2">
                          <span className="font-medium text-gray-800 dark:text-zinc-200">{s.name}</span>
                          <span className="ml-1 text-[11px] text-gray-400 dark:text-zinc-600 tabular-nums">{s.code}</span>
                          {s.industry ? (
                            <span className="block text-[11px] text-gray-400 dark:text-zinc-600">{s.industry}</span>
                          ) : null}
                        </td>
                        {isFunnel ? (
                          <>
                            <td className="py-2 px-2 whitespace-nowrap tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                              {s.growth != null ? `+${s.growth >= 1000 ? Math.round(s.growth) : s.growth}%` : "—"}
                            </td>
                            <td className={`py-2 px-2 whitespace-nowrap tabular-nums ${(s.chg60 ?? 0) < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                              {s.chg60 != null ? `${s.chg60 > 0 ? "+" : ""}${s.chg60}%` : "—"}
                            </td>
                            <td className="py-2 px-2 text-[12px] text-gray-600 dark:text-zinc-300">
                              {s.tag || "—"}
                              {s.alpha != null && (
                                <span className={`block text-[11px] ${s.alpha > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-600"}`}>
                                  {t("超额", "α")} {(s.alpha * 100).toFixed(1)}%
                                </span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-2 whitespace-nowrap tabular-nums text-gray-600 dark:text-zinc-400">
                              {s.height}{t("板", "")}
                            </td>
                            <td className="py-2 px-2 tabular-nums text-gray-600 dark:text-zinc-400">
                              {s.price != null ? s.price.toFixed(2) : "—"}
                            </td>
                            <td className="py-2 px-2">
                              {p != null ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="tabular-nums font-semibold text-gray-900 dark:text-zinc-100">{p}%</span>
                                  <span className="inline-block h-1.5 w-10 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden align-middle">
                                    <span
                                      className="block h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400"
                                      style={{ width: `${p}%` }}
                                    />
                                  </span>
                                </span>
                              ) : (
                                "—"
                              )}
                              {s.outcome != null && (
                                <span className={`block text-[11px] ${s.outcome ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-600"}`}>
                                  {s.outcome ? t("次日已晋级", "advanced") : t("次日断板", "broke")}
                                  {s.ret != null ? ` ${(s.ret * 100).toFixed(1)}%` : ""}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="py-2 pl-2 text-[12px] text-gray-500 dark:text-zinc-400 leading-snug max-w-[16rem]">
                          {isFunnel ? s.why : s.reason}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed border-t border-gray-100 dark:border-white/[0.04] pt-3">
            {isFunnel
              ? t(
                  "篮子=业绩预增中挑「政策主线+卖铲子位置」、剔除已爆炒(60日>80%)的观察组,等权持有 20 个交易日对比沪深300。业绩预告全市场可见,非私有信息——赚的只能是「耐心+纪律」的钱。预注册假设:小幅跑赢基准。仅供参考,非投资建议。",
                  "The basket picks 'policy-mainline + sell-shovels' names from earnings-growth candidates, drops the over-heated (60d >80%), and holds equal-weight 20 trading days vs CSI 300. Earnings pre-announcements are public, not private info — the only edge is patience + discipline. Pre-registered hypothesis: mild outperformance. Reference only, not investment advice."
                )
              : t(
                  "概率=历史基率经 LLM 微调后的「明日再涨停」校准值，不等于「该买」。涨停接力长期胜负需台账验证——预注册假设为盈亏偏负。仅供参考，非投资建议。",
                  "Probability is a calibrated 'limit-up again tomorrow' estimate (base rate + LLM nudge), not a buy signal. Whether limit-up relay pays needs ledger validation — the pre-registered hypothesis is net-negative P&L. Reference only, not investment advice."
                )}
          </p>
        </div>
        )
      })()}

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
