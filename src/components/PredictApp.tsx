"use client"

import { Fragment, useState } from "react"
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

type ScanKind = "zt" | "funnel" | "poly"
type FunnelMode = "growth" | "quality" | "wide"

// Funnel candidate strategies — which slice of the earnings-growth pool
// reaches the LLM. Kept as data so the chips row renders from one list.
const FUNNEL_MODES: { id: FunnelMode; zh: string; en: string; zhTip: string; enTip: string }[] = [
  { id: "growth", zh: "🚀 预增幅优先", en: "🚀 Top growth",
    zhTip: "按预增幅降序直取（含低基数怪胎）", enTip: "sorted by growth, low-base freaks included" },
  { id: "quality", zh: "🧐 质量优先", en: "🧐 Quality",
    zhTip: "剔除预增>1000%（低基数/并表）与近15日暴跌>30%（飞刀）", enTip: "drops >1000% low-base freaks and 15d>-30% falling knives" },
  { id: "wide", zh: "🌊 广撒网", en: "🌊 Wide net",
    zhTip: "候选池放大到80只，篮子最多15只", enTip: "80-candidate pool, basket up to 15" },
]

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
  outcome?: number | string | null
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
  // poly（Polymarket 纸面盲估）：code=市场id、name=市场问题
  outcome_a?: string
  outcome_b?: string
  url?: string
  domain?: string
  end_date?: string
  p_model?: number | null
  p_market?: number | null
  edge?: number | null
  traded?: boolean
  side?: "A" | "B" | null
  stake?: number | null
  pnl?: number | null
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

// 彩票统计分析（来自 /api/lottery，预计算后 git 追踪；不在请求时计算）。
// 两类结构：选号型（set，从K个号选n个）与数字型（digit，每位独立0-9）。
interface DltMethod {
  name: string
  mean_hits: number
  vs_base: number
  hit2: number
  hit3: number
  p_rows: number
  p_uniform: number
  significant: boolean
  next_pick: number[]
}
interface SetZone {
  /** 所有方法都没推荐的号码——用来暴露方法的盲区，不是另一种选号依据 */
  never_picked?: number[]
  zmax: number
  drawn: number
  pick: number
  baseline: number
  bonferroni: number
  significant: number
  uniformity: Record<string, { chi2: number; df: number; n: number; p: number }>
  methods: DltMethod[]
}
interface LotteryGame {
  id: string
  name: string
  kind: "set" | "digit"
  n: number
  first_date: string
  last_date: string
  recent: { 期号: string; 日期: string; nums: number[] }[]
  // set
  train?: number
  oos?: number
  n_methods?: number
  zones?: Record<string, SetZone>
  // digit
  digits?: number
  p?: {
    uniformity: number
    per_position: number[]
    independence_min: number | null
    serial_min: number
    sum_vs_theory: number
  }
  forms?: {
    sum_mean: number
    sum_theory_mean: number
    span_mean: number
    组选?: Record<string, number>
  }
  backtest?: {
    train: number
    oos: number
    pick: number
    baseline: number
    bonferroni: number
    significant: number
    n_tests: number
    positions: {
      pos: number
      never_picked?: number[]
      methods: {
        name: string
        mean_hits: number
        vs_base: number
        p_uniform: number
        significant: boolean
        next_pick: number[]
      }[]
    }[]
  }
}
interface LotteryAnalysis {
  /** 方法英文标识符 → 中文说明。中文是给人看的，英文是跨端对照用的代码标识。 */
  method_labels?: Record<string, string>
  meta: { ran_at: string; n_perm: number; seeds: number; source: string; games: string[] }
  games: Record<string, LotteryGame>
  verdict: string
}

interface Props {
  locale: "en" | "zh"
}

// Domain options mirror ForeSight's router. "auto" lets the engine
// classify; the rest let a user force a methodology.
// 'market' switches the UI into scan mode (limit-up relay / slow-money
// funnel over live eastmoney/Sina quotes) instead of a seed textarea;
// 'lottery' is a pure client-side quick-pick.
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
  { id: "poly", en: "Prediction markets", zh: "预测市场（Polymarket）" },
  { id: "nature", en: "Weather / nature", zh: "天气/自然" },
  { id: "metaphysics", en: "Metaphysics / fortune", zh: "玄学/命理" },
  { id: "industry", en: "Industry / career", zh: "行业/职业前瞻" },
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
    id: "pl3", zh: "排列3", en: "Pailie 3", rtp: "≈50%",
    groups: [{ name: { zh: "号码", en: "Digits" }, kind: "digits", count: 3 }],
  },
  {
    id: "pl5", zh: "排列5", en: "Pailie 5", rtp: "≈50%",
    groups: [{ name: { zh: "号码", en: "Digits" }, kind: "digits", count: 5 }],
  },
  {
    id: "qxc", zh: "七星彩", en: "Seven Star", rtp: "≈50%",
    groups: [{ name: { zh: "号码", en: "Digits" }, kind: "digits", count: 7 }],
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

/** 每个号被多少个方法推荐，票高者在前。
 *  与 neverPicked 同源同算法——都从当前渲染的 methods 现推，
 *  保证页面上的数字永远能被手工核对。 */
function consensus(z: SetZone): { n: number; votes: number }[] {
  const cnt = new Map<number, number>()
  for (const m of z.methods) for (const n of m.next_pick) cnt.set(n, (cnt.get(n) ?? 0) + 1)
  return [...cnt.entries()]
    .map(([n, votes]) => ({ n, votes }))
    .sort((a, b) => b.votes - a.votes || a.n - b.n)
}

/** 某区里所有方法都没推荐的号码。
 *  刻意从传入的 methods 现算，而不是用后端导出的字段——
 *  展示什么就用什么算，保证页面上的数字永远能被手工核对。 */
function neverPicked(z: SetZone): number[] {
  const picked = new Set<number>()
  for (const m of z.methods) for (const n of m.next_pick) picked.add(n)
  const out: number[] = []
  for (let i = 1; i <= z.zmax; i++) if (!picked.has(i)) out.push(i)
  return out
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
  const [funnelMode, setFunnelMode] = useState<FunnelMode>("growth")
  const [scanTop, setScanTop] = useState(12)
  const [lottery, setLottery] = useState<LotteryPick | null>(null)
  const [dlt, setDlt] = useState<LotteryAnalysis | null>(null)
  const [dltGame, setDltGame] = useState("dlt")
  const [dltLoading, setDltLoading] = useState(false)

  const isZh = locale === "zh"
  const t = (zh: string, en: string) => (isZh ? zh : en)
  const isMarket = domain === "market"
  const isPoly = domain === "poly"
  const isLottery = domain === "lottery"
  const isIndustry = domain === "industry"

  // 大乐透回测数据按需加载：只有切到彩票域才拉，避免拖慢首屏
  async function loadDlt() {
    if (dlt || dltLoading) return
    setDltLoading(true)
    try {
      // v= 是响应结构版本，结构变了就换 URL，绕开浏览器的长缓存
      const res = await fetch("/api/lottery?v=4")
      if (res.ok) {
        const j = (await res.json()) as LotteryAnalysis
        // 只接受当前格式：旧缓存/半成品导出一律当作没数据，
        // 免得格式演进期间前端整页崩掉。
        if (j && typeof j === "object" && j.games && typeof j.verdict === "string") {
          setDlt(j)
        }
      }
    } catch {
      /* 静默失败：这是附加信息，不该阻断机选主流程 */
    } finally {
      setDltLoading(false)
    }
  }

  function handleLottery(game: Lottery) {
    setError(null)
    setResult(null)
    setScan(null)
    setLottery(pickLottery(game, isZh))
    // 机选与分析共用同一个彩种：选了哪种就出哪种，不该让用户在两处各选一次
    setDltGame(game.id)
    void loadDlt()
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
        body: JSON.stringify({
          ...key,
          scan: kind,
          // poly 每个市场一次串行 LLM 盲估，压到 ≤10 保住函数 60s 预算
          top:
            kind === "poly"
              ? Math.max(1, Math.min(scanTop || 8, 10))
              : Math.max(1, Math.min(scanTop || 12, 30)),
          ...(kind === "funnel" ? { mode: funnelMode } : {}),
        }),
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
      {/* Input — hidden in market-scan / poly-scan / lottery modes (no seed). */}
      {!isMarket && !isPoly && !isLottery && (
        <textarea
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder={
            isIndustry
              ? t(
                  "带上背景建议才定制：城市/技能/资金/每周可投入时间。例：成都前端5年、有10万、每周20小时,想转游戏,做什么品类?用Unity还是Cocos?也可以直接问:2026现在的风口是什么?",
                  "Add your context for tailored advice: city, skills, budget, weekly hours. E.g. 5y frontend in Chengdu, $15k, 20h/week — which game genre? Unity or Cocos? Or just ask: what's the hot wave in 2026?"
                )
              : t(
                  "描述一个未来事件，例如：美伊关系未来 60 天是否会升级？特斯拉下季度交付量会创新高吗？",
                  "Describe a future event, e.g. Will US-Iran tensions escalate in the next 60 days? Will Tesla set a delivery record next quarter?"
                )
          }
          rows={3}
          className="w-full resize-y rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-3 py-2 text-sm text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
      )}

      {isMarket && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
          {t(
            "不用输代码,两种扫法都自动扫全市场,行情来自东财/新浪：",
            "No code needed — both scans sweep the whole market with live eastmoney / Sina quotes:"
          )}
          <br />
          <span className="text-rose-600 dark:text-rose-400 font-medium">{t("🔥 打板(快钱)", "🔥 Relay (fast)")}</span>
          {t("：当日涨停池(二板及以上),给「明日再涨停」概率。", " — today's limit-up pool (2nd board+), 'limit-up again tomorrow' probability. ")}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t("🐢 漏斗(慢钱)", "🐢 Funnel (slow)")}</span>
          {t("：业绩预增+卖铲子位置的观察篮,持有 20 日对比沪深300。", " — an earnings-growth 'sell-shovels' basket, held 20 days vs CSI 300.")}
        </p>
      )}

      {isPoly && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
          {t(
            "对 Polymarket 活跃二元市场做纸面盲估：AI 全程看不到盘价,独立给出概率,再与市场价对比。|盲估−盘价|≥8% 时记一笔虚拟凯利仓(单笔上限6%)——只记账,绝不下单。这是校准实验,预注册假设:市场价比模型准。短期天气/币价阈值/纯随机类会按纪律直接拒测。",
            "Paper blind-estimates on active Polymarket binaries: the AI never sees the market price, gives its own probability, then we compare. When |estimate − price| ≥ 8% a virtual Kelly position (6% cap) is logged — ledger only, never an order. It's a calibration experiment; the pre-registered hypothesis is that the market price wins. Short-term weather, crypto price thresholds and pure randomness are refused on principle."
          )}
        </p>
      )}

      {isIndustry && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
          {t(
            "输出会落到「具体项目 + 技术选型 + 地域适配」三件套,并附「别碰的坑」与判断失效条件。风口类问题直接点名排序;建议仅供参考,重大决定请多方求证。",
            "Answers land on three concrete things — projects to start, tech choices, and regional fit — plus pitfalls to avoid and when the judgment breaks. Hot-wave questions get a direct ranked answer. Reference only; verify before big decisions."
          )}
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


      {/* 彩票统计分析：7 个彩种的预计算结论 + 原始数据下载。
          放在机选下面而不是上面——机选是这一页的功能，分析是它的注脚。 */}
      {isLottery && (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              📊 {dlt?.games?.[dltGame]?.name ?? ""}
              {t(" 历史数据与统计检验", " — history & statistical tests")}
            </span>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                这是 API 路由的文件下载，不是页面跳转：<Link> 会走客户端路由，
                拿不到 Content-Disposition，下载会失效。 */}
            <a
              href={`/api/lottery?game=${dltGame}&format=csv&v=4`}
              download={`${dltGame}_history.csv`}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
            >
              {t("⬇ 下载该彩种全量历史 CSV", "⬇ Download full history CSV")}
            </a>
          </div>

          {dltLoading && (
            <p className="text-xs text-gray-400 dark:text-zinc-600">{t("加载中…", "Loading…")}</p>
          )}
          {!dlt && !dltLoading && (
            <p className="text-xs text-gray-400 dark:text-zinc-600">
              {t("点上方任一彩种，机选与该彩种的统计检验一起出。",
                 "Pick any game above — the quick-pick and that game's statistical tests come together.")}
            </p>
          )}

          {dlt && (
            <>
              {(() => {
                const g = dlt.games?.[dltGame]
                if (!g) return null
                const meta = (
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                    {g.n} {t("期", "draws")}（{g.first_date} → {g.last_date}）
                    {g.kind === "set"
                      ? t(
                          `，前 ${g.train} 期训练、${g.oos} 期样本外，每期只用该期之前的数据预测；${g.n_methods} 个方法各做 ${dlt.meta.n_perm} 次排列检验（两套零假设）。`,
                          `; first ${g.train} for training, ${g.oos} out-of-sample; ${g.n_methods} methods × ${dlt.meta.n_perm} permutations under two null hypotheses.`
                        )
                      : t(
                          `。数字型游戏：每位独立 0-9、可重复、看顺序——「选N码」在这里没有意义，正确的检验是各位是否均匀、期与期之间有无记忆。`,
                          `. Digit game: each position is an independent uniform 0-9, so the right test is per-position uniformity and serial memory.`
                        )}
                  </p>
                )

                if (g.kind === "digit" && g.p) {
                  const tests: [string, number][] = [
                    [t("各位数字均匀性", "Per-position uniformity"), g.p.uniformity],
                    [t("期间记忆性（最小p）", "Serial memory (min p)"), g.p.serial_min],
                    [t("和值 vs 组合数学理论", "Sum vs combinatorial theory"), g.p.sum_vs_theory],
                  ]
                  if (g.p.independence_min != null)
                    tests.splice(2, 0, [t("位间独立性（最小p）", "Positional independence"), g.p.independence_min])
                  return (
                    <>
                      {meta}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {tests.map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-gray-50 dark:bg-white/[0.04] p-2">
                            <div className="text-[10px] text-gray-400 dark:text-zinc-600">{k}</div>
                            <div className={`text-sm font-semibold tabular-nums ${v < 0.01 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                              p = {v.toFixed(3)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {g.forms?.组选 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-left text-[10px] text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.06]">
                                <th className="py-1.5 pr-2 font-medium">{t("形态", "Pattern")}</th>
                                <th className="py-1.5 px-2 font-medium tabular-nums">{t("实测", "Observed")}</th>
                                <th className="py-1.5 px-2 font-medium tabular-nums">{t("组合数学理论", "Theory")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {["组三", "组六", "豹子"].map((k) => (
                                <tr key={k} className="border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                                  <td className="py-1.5 pr-2 text-gray-700 dark:text-zinc-300">{k}</td>
                                  <td className="py-1.5 px-2 tabular-nums text-gray-600 dark:text-zinc-400">{g.forms?.组选?.[k]}</td>
                                  <td className="py-1.5 px-2 tabular-nums text-gray-500 dark:text-zinc-500">{g.forms?.组选?.[`${k}理论`]}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {g.backtest && (
                        <>
                          <div className="text-[11px] text-gray-500 dark:text-zinc-400 pt-1">
                            {t(
                              `逐位回测：每一位就是一个「10选1」的小游戏，同样走 walk-forward（训练${g.backtest.train}期／样本外${g.backtest.oos}期）+ 排列检验。每位推${g.backtest.pick}个数字，随机基准 ${g.backtest.baseline}。通过 Bonferroni(${g.backtest.bonferroni.toFixed(4)}) 的：${g.backtest.significant}/${g.backtest.n_tests}`,
                              `Per-position backtest: each position is a "1 of 10" game, run through the same walk-forward (${g.backtest.train} train / ${g.backtest.oos} OOS) plus permutation tests. ${g.backtest.pick} digits per position, random baseline ${g.backtest.baseline}. Passing Bonferroni(${g.backtest.bonferroni.toFixed(4)}): ${g.backtest.significant}/${g.backtest.n_tests}`
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="text-left text-[10px] text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.06]">
                                  <th className="py-1 pr-2 font-medium">{t("位", "Pos")}</th>
                                  <th className="py-1 px-2 font-medium">{t("方法", "Method")}</th>
                                  <th className="py-1 px-2 font-medium tabular-nums">{t("命中率", "Hit rate")}</th>
                                  <th className="py-1 px-2 font-medium tabular-nums">{t("vs随机", "vs random")}</th>
                                  <th className="py-1 px-2 font-medium tabular-nums">p</th>
                                  <th className="py-1 pl-2 font-medium">{t("预估数字", "Picks")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.backtest.positions.flatMap((pos) =>
                                  pos.methods
                                    .filter((m) => ["freq_hot", "omit_max", "fuse_equal", "random"].includes(m.name))
                                    .map((m) => (
                                      <tr key={`${pos.pos}-${m.name}`} className="border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                                        <td className="py-1 pr-2 text-gray-600 dark:text-zinc-400">{pos.pos}</td>
                                        <td className="py-1 px-2">
                                          <span className="font-medium text-gray-700 dark:text-zinc-300">
                                            {dlt.method_labels?.[m.name] ?? m.name}
                                          </span>
                                          <span className="block text-[10px] text-gray-400 dark:text-zinc-600">{m.name}</span>
                                        </td>
                                        <td className="py-1 px-2 tabular-nums text-gray-600 dark:text-zinc-400">{m.mean_hits.toFixed(3)}</td>
                                        <td className={`py-1 px-2 tabular-nums ${m.vs_base > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-600"}`}>
                                          {m.vs_base > 0 ? "+" : ""}{m.vs_base.toFixed(3)}
                                        </td>
                                        <td className={`py-1 px-2 tabular-nums ${m.significant ? "text-rose-500" : "text-gray-400 dark:text-zinc-600"}`}>
                                          {m.p_uniform.toFixed(3)}
                                        </td>
                                        <td className="py-1 pl-2 tabular-nums text-gray-500 dark:text-zinc-500">
                                          {m.next_pick.join(" ")}
                                        </td>
                                      </tr>
                                    ))
                                )}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed">
                            {t(
                              "「预估数字」是各方法的机械输出，旁边的 p 值就是它的成色——注意随机对照组(random)也会给出一组数字，且表现与其它方法无异。这正是重点：在 p 值证明有信号之前，任何一组预估都和随便写三个数一样。",
                              "The picks are mechanical outputs; the p-value beside them is their worth. Note the random control also produces picks and performs no differently — which is the point: absent a significant p-value, any set of picks is as good as three digits written at random."
                            )}
                          </p>
                        </>
                      )}
                      <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed border-t border-gray-100 dark:border-white/[0.04] pt-2">
                        {t(
                          "组三/组六的比例由组合数学决定（3位数中恰好两位相同的排列占27%），不是「规律」。实测与理论吻合，恰恰说明摇奖是公平的。",
                          "The 组三/组六 split is fixed by combinatorics (27% of 3-digit strings have exactly two equal digits) — not a pattern. Matching theory is evidence the draw is fair."
                        )}
                      </p>
                    </>
                  )
                }

                const zones = Object.entries(g.zones ?? {})
                return (
                  <>
                    {meta}
                    {zones.map(([zname, z]) => (
                      <div key={zname} className="space-y-1.5">
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                          <span className="font-medium text-gray-700 dark:text-zinc-300">{zname}</span>
                          {` ${z.zmax}选${z.drawn}`}
                          {t(`，推荐${z.pick}码　随机基准 ${z.baseline.toFixed(3)}　通过 Bonferroni(${z.bonferroni.toFixed(4)}) 的方法 ${z.significant}/${z.methods.length}`,
                             ` — ${z.pick} picks; random baseline ${z.baseline.toFixed(3)}; ${z.significant}/${z.methods.length} pass Bonferroni ${z.bonferroni.toFixed(4)}`)}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="text-left text-[10px] text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.06]">
                                <th className="py-1 pr-2 font-medium">{t("方法", "Method")}</th>
                                <th className="py-1 px-2 font-medium tabular-nums">{t("OOS均值", "OOS mean")}</th>
                                <th className="py-1 px-2 font-medium tabular-nums">{t("vs随机", "vs random")}</th>
                                <th className="py-1 px-2 font-medium tabular-nums">p</th>
                                <th className="py-1 pl-2 font-medium">{t("该法推荐", "Its picks")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* 不截断：盲区那一栏按全部方法计算，只显示前 6 个的话
                                  用户手数会得到不同答案却无从核对（实测被指出过）。
                                  而且被截掉的里面就有 random 对照组——那一行恰恰
                                  最该被看到：它同样会给出一组号，表现却与其它方法无异。 */}
                              {z.methods.map((m) => (
                                <tr key={m.name} className="border-b border-gray-50 dark:border-white/[0.03] last:border-0">
                                  <td className="py-1 pr-2">
                                    <span className="font-medium text-gray-700 dark:text-zinc-300">
                                      {dlt.method_labels?.[m.name] ?? m.name}
                                    </span>
                                    <span className="block text-[10px] text-gray-400 dark:text-zinc-600">{m.name}</span>
                                  </td>
                                  <td className="py-1 px-2 tabular-nums text-gray-600 dark:text-zinc-400">{m.mean_hits.toFixed(3)}</td>
                                  <td className={`py-1 px-2 tabular-nums ${m.vs_base > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-zinc-600"}`}>
                                    {m.vs_base > 0 ? "+" : ""}{m.vs_base.toFixed(3)}
                                  </td>
                                  <td className={`py-1 px-2 tabular-nums ${m.significant ? "text-rose-500" : "text-gray-400 dark:text-zinc-600"}`}>
                                    {m.p_uniform.toFixed(3)}
                                  </td>
                                  <td className="py-1 pl-2 tabular-nums text-gray-500 dark:text-zinc-500">
                                    {m.next_pick.map((n) => String(n).padStart(2, "0")).join(" ")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    {/* 盲区从**当前渲染的行**推导，而不是读导出字段。
                        原因：曾经表格截断到 6 行、盲区却按全部 16 个方法算，
                        用户手数得到 4/13/20、页面写 13，两个都对却无从核对。
                        改成从 z.methods 现算，就不可能再和眼前看到的对不上。 */}
                    {zones.some(([, z]) => neverPicked(z).length > 0) && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-2.5 space-y-1">
                        {zones.map(([zname, z]) => {
                          const top = consensus(z).filter((c) => c.votes >= z.methods.length / 2)
                          return top.length > 0 ? (
                            <div key={`c-${zname}`} className="text-[11px] text-gray-600 dark:text-zinc-300">
                              <span className="font-medium">{zname}</span>
                              {t("：被过半方法推荐 → ", " — picked by over half the methods: ")}
                              <span className="tabular-nums">
                                {/* 每项后面跟一个真实空格：margin 只影响视觉，
                                    innerText / 复制粘贴时数字会粘成 "01 (10)16 (9)" */}
                                {/* 用 Fragment 让空格成为外层的真实文本节点：
                                    放进 inline-block 里会被折叠，复制出来数字会粘连 */}
                                {top.map((c, i) => (
                                  <Fragment key={c.n}>
                                    {i > 0 ? "  " : ""}
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {String(c.n).padStart(2, "0")}
                                    </span>
                                    <span className="text-gray-400 dark:text-zinc-600">
                                      {"\u00A0"}({c.votes})
                                    </span>
                                  </Fragment>
                                ))}
                              </span>
                            </div>
                          ) : null
                        })}
                        {zones.map(([zname, z]) =>
                          neverPicked(z).length > 0 ? (
                            <div key={zname} className="text-[11px] text-gray-600 dark:text-zinc-300">
                              <span className="font-medium">{zname}</span>
                              {t("：上表全部 ", " — none of the ")}
                              {z.methods.length}
                              {t(" 个方法都没推荐 → ", " methods above picked: ")}
                              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                                {neverPicked(z).map((n) => String(n).padStart(2, "0")).join(" ")}
                              </span>
                            </div>
                          ) : null
                        )}
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 leading-relaxed pt-0.5">
                          {t(
                            "括号里是推荐它的方法数。⚠️ 高票不等于强证据：这些方法高度相关——「热号 / 贝叶斯平滑 / 偏离均匀程度」三者在数学上就是同一个东西（OOS均值都是 1.864、p 都是 0.015），12 个方法推荐同一个号不是 12 份独立证据。而下面「无人推荐」的号也不是「不会开」：2026-08-30 双色球开出 13 号，恰恰无一方法推荐它，同期六个方法平均只命中 1.33 个红球（随机期望 1.82）。两栏都只是让方法的行为可见，都不构成选号依据。",
                            "These are not predictions of absence — the opposite: on 2026-08-30 the SSQ draw included 13, which none of the 16 methods picked, while the six shown methods averaged 1.33 red-ball hits against a random expectation of 1.82. This row exposes the methods' blind spot; it is not another basis for picking."
                          )}
                        </p>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed border-t border-gray-100 dark:border-white/[0.04] pt-2">
                      {t(
                        "两套零假设缺一不可：行置换不改变各号码总频次，对频率类方法无鉴别力；均匀重采样才检验号码级偏差。表中「推荐」是各方法的机械输出，在 p 值证明有信号之前，它和随机选号没有区别。",
                        "Both nulls are required: row permutation preserves per-number totals and cannot discriminate frequency methods; uniform resampling tests number-level bias. Picks shown are mechanical outputs — absent a significant p-value they are indistinguishable from random."
                      )}
                    </p>
                  </>
                )
              })()}

              {typeof dlt.verdict === "string" && (
                <p className="text-[11px] text-gray-400 dark:text-zinc-600 leading-relaxed">
                  {dlt.verdict}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Domain picker + action button(s) */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value)
            if (e.target.value === "lottery") void loadDlt()
          }}
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
            {/* How many names to return (both scans; server clamps to 1-15) */}
            <label className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
              {t("数量", "Count")}
              <input
                type="number"
                min={1}
                max={30}
                value={scanTop}
                onChange={(e) => setScanTop(Number(e.target.value))}
                disabled={loading}
                className="w-14 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-1.5 py-1 text-xs text-gray-700 dark:text-zinc-300 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:opacity-40"
              />
            </label>
            {/* Funnel candidate-strategy chips (only affect the funnel scan) */}
            <span className="inline-flex items-center gap-1 flex-wrap">
              {FUNNEL_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFunnelMode(m.id)}
                  disabled={loading}
                  title={isZh ? m.zhTip : m.enTip}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-40 ${
                    funnelMode === m.id
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-400/50"
                      : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {isZh ? m.zh : m.en}
                </button>
              ))}
            </span>
          </>
        ) : isPoly ? (
          <>
            <button
              type="button"
              onClick={() => handleScan("poly")}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("🎲 扫盲估", "🎲 Blind scan")}
            </button>
            <label className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
              {t("数量", "Count")}
              <input
                type="number"
                min={1}
                max={10}
                value={scanTop}
                onChange={(e) => setScanTop(Number(e.target.value))}
                disabled={loading}
                className="w-14 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-1.5 py-1 text-xs text-gray-700 dark:text-zinc-300 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:opacity-40"
              />
            </label>
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
              : isPoly
                ? t("拉取市场 + 逐个盲估,约 15-40 秒", "Fetching markets + blind estimates, ~15-40s")
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
        const isPolyScan = scan.scan === "poly"
        const accent = isFunnel
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : isPolyScan
            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
            : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        return (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${accent}`}>
              {isFunnel
                ? `🐢 ${t("慢钱漏斗观察篮", "Slow-money basket")}`
                : isPolyScan
                  ? `🎲 ${t("Polymarket 纸面盲估", "Polymarket paper blind-estimates")}`
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
                : isPolyScan
                  ? t("暂无通过过滤与拒测线的活跃市场。", "No active markets pass the filters and refusal rules.")
                  : t("今日涨停池暂无二板及以上标的（或非交易日）。", "No 2nd-board+ stocks in today's pool (or not a trading day).")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.06]">
                    <th className="py-1.5 pr-2 font-medium">
                      {isPolyScan ? t("市场", "Market") : t("名称", "Name")}
                    </th>
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
                    ) : isPolyScan ? (
                      <>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("盘价A", "Price A")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("盲估A", "Blind est.")}</th>
                        <th className="py-1.5 px-2 font-medium tabular-nums">{t("差", "Edge")}</th>
                        <th className="py-1.5 px-2 font-medium">{t("纸面动作", "Paper action")}</th>
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
                          {isPolyScan ? (
                            <>
                              {s.url ? (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-gray-800 dark:text-zinc-200 hover:text-sky-600 dark:hover:text-sky-400 hover:underline"
                                >
                                  {s.name}
                                </a>
                              ) : (
                                <span className="font-medium text-gray-800 dark:text-zinc-200">{s.name}</span>
                              )}
                              <span className="block text-[11px] text-gray-400 dark:text-zinc-600">
                                {s.end_date ? `${t("到期", "ends")} ${s.end_date}` : ""}
                                {s.domain ? ` · ${s.domain}` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-gray-800 dark:text-zinc-200">{s.name}</span>
                              <span className="ml-1 text-[11px] text-gray-400 dark:text-zinc-600 tabular-nums">{s.code}</span>
                              {s.industry ? (
                                <span className="block text-[11px] text-gray-400 dark:text-zinc-600">{s.industry}</span>
                              ) : null}
                            </>
                          )}
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
                        ) : isPolyScan ? (
                          <>
                            <td className="py-2 px-2 whitespace-nowrap tabular-nums text-gray-600 dark:text-zinc-400">
                              {s.p_market != null ? `${Math.round(s.p_market * 100)}%` : "—"}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap tabular-nums font-semibold text-gray-900 dark:text-zinc-100">
                              {s.p_model != null ? `${Math.round(s.p_model * 100)}%` : "—"}
                            </td>
                            <td
                              className={`py-2 px-2 whitespace-nowrap tabular-nums font-medium ${
                                s.traded
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-gray-400 dark:text-zinc-600"
                              }`}
                            >
                              {s.edge != null ? `${s.edge > 0 ? "+" : ""}${Math.round(s.edge * 100)}%` : "—"}
                            </td>
                            <td className="py-2 px-2 text-[12px] text-gray-600 dark:text-zinc-300 max-w-[10rem]">
                              {s.traded
                                ? `${t("买", "Buy")} ${(s.side === "A" ? s.outcome_a : s.outcome_b) ?? s.side}${s.stake != null ? ` · ${s.stake}u` : ""}`
                                : t("仅记录", "log only")}
                              {s.outcome != null && (
                                <span
                                  className={`block text-[11px] ${
                                    s.pnl != null && s.pnl > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-gray-400 dark:text-zinc-600"
                                  }`}
                                >
                                  {s.outcome === "void"
                                    ? t("50-50作废", "voided 50-50")
                                    : s.outcome === 1
                                      ? `→ ${s.outcome_a ?? "A"} ✓`
                                      : `→ ${s.outcome_b ?? "B"} ✓`}
                                  {s.pnl != null ? ` ${s.pnl > 0 ? "+" : ""}${s.pnl}u` : ""}
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
              : isPolyScan
                ? t(
                    "盲估=AI 不看盘价独立给概率;差=盲估−盘价。|差|≥8% 记一笔虚拟凯利仓(上限6%、本金100u、不复利)——只记账,绝不下单。结算后对比双 Brier(模型 vs 市场价);预注册假设:市场价更准、纸面盈亏≤0。纸面成交不含点差/滑点/费用,是乐观上界。非投注建议。",
                    "Blind = the AI prices each market without seeing it; edge = estimate − price. |edge| ≥ 8% logs a virtual Kelly position (6% cap, 100u bankroll, no compounding) — ledger only, never an order. After resolution we compare double Brier (model vs market price); pre-registered hypothesis: the market wins and paper P&L ≤ 0. Paper fills ignore spread/slippage/fees — an optimistic upper bound. Not betting advice."
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
