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
  chg120?: number | null
  chg60?: number | null
  chg30?: number | null
  chg15?: number | null
  chg7?: number | null
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
  { id: "lottery", en: "Lottery / lucky pick", zh: "彩票/幸运号" },
]

// Domain → display label + accent. Keeps the result badge readable.
const DOMAIN_LABEL: Record<string, { en: string; zh: string }> = Object.fromEntries(
  DOMAINS.filter((d) => d.id !== "auto").map((d) => [d.id, { en: d.en, zh: d.zh }])
)

// ── Lottery quick-pick (client-side) ─────────────────────────────────
// Lottery numbers are provably unpredictable, so there is nothing to
// "predict" and no reason to route them through an LLM — an "AI picked
// your numbers" implication is exactly the con this project refuses to
// run. We generate a fair random quick-pick locally with the browser CSPRNG
// (crypto.getRandomValues), instantly and with no API key, and pair it
// with the game's real payout ratio so the framing stays honest.
type LotteryGroup =
  | { name: { zh: string; en: string }; kind: "pick"; min: number; max: number; count: number }
  | { name: { zh: string; en: string }; kind: "digits"; count: number }

interface Lottery {
  id: string
  zh: string
  en: string
  groups: LotteryGroup[]
  /** Official return-to-player, shown verbatim in the honest note. */
  rtp: string
}

const LOTTERIES: Lottery[] = [
  {
    id: "ssq", zh: "双色球", en: "Double Color Ball", rtp: "≈50%",
    groups: [
      { name: { zh: "红球", en: "Red" }, kind: "pick", min: 1, max: 33, count: 6 },
      { name: { zh: "蓝球", en: "Blue" }, kind: "pick", min: 1, max: 16, count: 1 },
    ],
  },
  {
    id: "dlt", zh: "大乐透", en: "Grand Lotto", rtp: "≈50%",
    groups: [
      { name: { zh: "前区", en: "Front" }, kind: "pick", min: 1, max: 35, count: 5 },
      { name: { zh: "后区", en: "Back" }, kind: "pick", min: 1, max: 12, count: 2 },
    ],
  },
  {
    id: "qlc", zh: "七乐彩", en: "Seven Lotto", rtp: "≈50%",
    groups: [{ name: { zh: "基本号", en: "Main" }, kind: "pick", min: 1, max: 30, count: 7 }],
  },
  {
    id: "fc3d", zh: "福彩3D", en: "Fucai 3D", rtp: "≈50%",
    groups: [{ name: { zh: "号码", en: "Digits" }, kind: "digits", count: 3 }],
  },
  {
    id: "pl5", zh: "排列5", en: "Pailie 5", rtp: "≈50%",
    groups: [{ name: { zh: "号码", en: "Digits" }, kind: "digits", count: 5 }],
  },
]

/** Uniform integer in [min, max] via CSPRNG, rejection-sampled to avoid
 *  modulo bias. */
function randInt(min: number, max: number): number {
  const range = max - min + 1
  const limit = Math.floor(0xffffffff / range) * range
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return min + (buf[0] % range)
}

interface LotteryPick {
  gameId: string
  label: string
  groups: { name: string; numbers: number[] }[]
}

function pickLottery(game: Lottery, isZh: boolean): LotteryPick {
  const groups = game.groups.map((g) => {
    let numbers: number[]
    if (g.kind === "pick") {
      const pool = Array.from({ length: g.max - g.min + 1 }, (_, i) => g.min + i)
      for (let i = 0; i < g.count; i++) {
        const j = i + randInt(0, pool.length - 1 - i)
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      numbers = pool.slice(0, g.count).sort((a, b) => a - b)
    } else {
      // Independent digits 0-9, order matters, repeats allowed.
      numbers = Array.from({ length: g.count }, () => randInt(0, 9))
    }
    return { name: isZh ? g.name.zh : g.name.en, numbers }
  })
  return { gameId: game.id, label: isZh ? game.zh : game.en, groups }
}

export function PredictApp({ locale }: Props) {
  const [seed, setSeed] = useState("")
  const [domain, setDomain] = useState("auto")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [scan, setScan] = useState<MarketScan | null>(null)
  const [lottery, setLottery] = useState<LotteryPick | null>(null)

  const isZh = locale === "zh"
  const t = (zh: string, en: string) => (isZh ? zh : en)
  const isMarket = domain === "market"
  const isLottery = domain === "lottery"

  function handleLottery(game: Lottery) {
    setError(null)
    setResult(null)
    setScan(null)
    setLottery(pickLottery(game, isZh))
  }

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
      // The response may not be JSON — e.g. a slow scan that trips the
      // serverless timeout returns a plain-text error page. Parse defensively
      // so we show a clean message instead of "Unexpected token …".
      const raw = await res.text()
      let data: (MarketScan & { error?: string }) | null = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }
      if (!res.ok || !data) {
        setError(
          data?.error ??
            t(
              "扫描失败或超时（漏斗要拉全市场行情，偶尔较慢）。稍等几秒再点一次。",
              "Scan failed or timed out (the funnel fetches market-wide quotes and can be slow). Wait a moment and try again."
            )
        )
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
      {/* Input — hidden in market-scan and lottery modes (no seed). */}
      {!isMarket && !isLottery && (
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

      {isLottery && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
          {t(
            "选个彩种一键机选——号码由你浏览器的密码学随机数即时生成,不经过 AI,不上传。彩票每期独立、无记忆,任何「预测」都无效;这只是把机选搬到本地,纯娱乐。",
            "Pick a game for an instant quick-pick — numbers come straight from your browser's cryptographic RNG, no AI, nothing uploaded. Each draw is independent and memoryless, so any 'prediction' is void; this is just a local quick-pick, for fun only."
          )}
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
        ) : isLottery ? (
          LOTTERIES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleLottery(g)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium shadow-sm transition-colors"
            >
              🎲 {isZh ? g.zh : g.en}
            </button>
          ))
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

      {/* Lottery quick-pick result — balls + honest note */}
      {lottery && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              🎲 {lottery.label} · {t("机选一注", "one quick-pick")}
            </span>
            <button
              type="button"
              onClick={() => {
                const g = LOTTERIES.find((x) => x.id === lottery.gameId)
                if (g) handleLottery(g)
              }}
              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
            >
              {t("↻ 再来一注", "↻ Pick again")}
            </button>
          </div>

          <div className="space-y-3">
            {lottery.groups.map((grp, gi) => (
              <div key={gi} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-zinc-500 w-12 shrink-0">{grp.name}</span>
                {grp.numbers.map((n, ni) => (
                  <span
                    key={ni}
                    className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold tabular-nums ${
                      gi === 0
                        ? "bg-rose-500 text-white"
                        : "bg-sky-500 text-white"
                    }`}
                  >
                    {String(n).padStart(2, "0")}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed border-t border-gray-100 dark:border-white/[0.04] pt-3">
            {t(
              `号码由浏览器密码学随机数(crypto)即时生成,每个号等概率,不改变任何中奖概率。${lottery.label}官方返奖率约 50%——长期每投 100 元约返 50 元。请把它当乐趣的花费,不是投资。声称能算中彩票的都是骗局。`,
              `Numbers come from the browser's cryptographic RNG — every number equally likely, changing no odds. ${lottery.label}'s official payout is ~50%, i.e. long-run you get back ~50 of every 100 spent. Treat it as the cost of fun, not an investment. Anyone claiming to predict the lottery is running a con.`
            )}
          </p>
        </div>
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
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("120日", "120d")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("60日", "60d")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("30日", "30d")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("15日", "15d")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("7日", "7d")}</th>
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
                            {([s.chg120, s.chg60, s.chg30, s.chg15, s.chg7] as (number | null | undefined)[]).map((chg, ci) => (
                              <td
                                key={ci}
                                className={`py-2 px-2 whitespace-nowrap tabular-nums ${
                                  chg == null
                                    ? "text-gray-400 dark:text-zinc-600"
                                    : chg < 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-500 dark:text-rose-400"
                                }`}
                              >
                                {chg != null ? `${chg > 0 ? "+" : ""}${chg}%` : "—"}
                              </td>
                            ))}
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
