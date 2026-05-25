// Client-safe: only meta, no fetch logic, no Node.js imports
import type { SourceMeta, SourceColumn } from "@/lib/types"

const ALL_COLUMNS: { id: SourceColumn; label: string; labelEn: string }[] = [
  { id: "china",         label: "中国",   labelEn: "China"         },
  { id: "tech",          label: "科技",   labelEn: "Tech"          },
  { id: "finance",       label: "财经",   labelEn: "Finance"       },
  { id: "global",        label: "全球",   labelEn: "Global"        },
  { id: "ai",            label: "AI",     labelEn: "AI"            },
  { id: "entertainment", label: "娱乐",   labelEn: "Entertainment" },
]

// zh: China first   en: Global / AI first, China last
export const COLUMNS_ZH = ALL_COLUMNS
export const COLUMNS_EN = [
  ALL_COLUMNS.find((c) => c.id === "global")!,
  ALL_COLUMNS.find((c) => c.id === "ai")!,
  ALL_COLUMNS.find((c) => c.id === "tech")!,
  ALL_COLUMNS.find((c) => c.id === "finance")!,
  ALL_COLUMNS.find((c) => c.id === "entertainment")!,
  ALL_COLUMNS.find((c) => c.id === "china")!,
]

export function getColumns(locale: string) {
  return locale === "zh" ? COLUMNS_ZH : COLUMNS_EN
}

// Keep COLUMNS as the full set for backwards-compat (sidebar filters etc.)
export const COLUMNS = ALL_COLUMNS

export const sourceMeta: Record<string, SourceMeta> = {
  // ── China ──────────────────────────────────────────────
  weibo: {
    id: "weibo", icon: "🌊", column: "china",
    accentColor: "bg-gradient-to-r from-orange-400 to-red-500",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  baidu: {
    id: "baidu", icon: "🔍", column: "china",
    accentColor: "bg-gradient-to-r from-blue-600 to-blue-400",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  zhihu: {
    id: "zhihu", icon: "🔵", column: "china",
    accentColor: "bg-gradient-to-r from-blue-500 to-indigo-500",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  bilibili: {
    id: "bilibili", icon: "📺", column: "china",
    accentColor: "bg-gradient-to-r from-pink-500 to-rose-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  toutiao: {
    id: "toutiao", icon: "📰", column: "china",
    accentColor: "bg-gradient-to-r from-red-500 to-orange-400",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  tieba: {
    id: "tieba", icon: "💬", column: "china",
    accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  douyin: {
    id: "douyin", icon: "🎵", column: "china",
    accentColor: "bg-gradient-to-r from-pink-500 to-fuchsia-400",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  ifeng: {
    id: "ifeng", icon: "🦅", column: "china",
    accentColor: "bg-gradient-to-r from-orange-600 to-red-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  thepaper: {
    id: "thepaper", icon: "📄", column: "china",
    accentColor: "bg-gradient-to-r from-gray-600 to-slate-500",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  tencent: {
    id: "tencent", icon: "🐧", column: "china",
    accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  nowcoder: {
    id: "nowcoder", icon: "💻", column: "china",
    accentColor: "bg-gradient-to-r from-green-500 to-emerald-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  douban: {
    id: "douban", icon: "🎬", column: "china",
    accentColor: "bg-gradient-to-r from-green-600 to-lime-500",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  iqiyi: {
    id: "iqiyi", icon: "🎥", column: "china",
    accentColor: "bg-gradient-to-r from-green-500 to-teal-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  zaobao: {
    id: "zaobao", icon: "🗞️", column: "china",
    accentColor: "bg-gradient-to-r from-red-700 to-red-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  cankaoxiaoxi: {
    id: "cankaoxiaoxi", icon: "📰", column: "china",
    accentColor: "bg-gradient-to-r from-slate-600 to-gray-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  sputniknewscn: {
    id: "sputniknewscn", icon: "🌐", column: "china",
    accentColor: "bg-gradient-to-r from-blue-700 to-indigo-600",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // kaopu disabled — upstream stays too stale even with the 48h filter
  // kaopu: {
  //   id: "kaopu", icon: "✅", column: "china",
  //   accentColor: "bg-gradient-to-r from-teal-500 to-cyan-400",
  //   interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  // },
  hupu: {
    id: "hupu", icon: "🏀", column: "china",
    accentColor: "bg-gradient-to-r from-orange-500 to-amber-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // ── Tech ───────────────────────────────────────────────
  "36kr": {
    id: "36kr", icon: "💡", column: "tech",
    accentColor: "bg-gradient-to-r from-blue-400 to-cyan-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  ithome: {
    id: "ithome", icon: "🖥️", column: "tech",
    accentColor: "bg-gradient-to-r from-red-400 to-orange-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  sspai: {
    id: "sspai", icon: "✂️", column: "tech",
    accentColor: "bg-gradient-to-r from-red-400 to-rose-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  juejin: {
    id: "juejin", icon: "⚡", column: "tech",
    accentColor: "bg-gradient-to-r from-blue-400 to-sky-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  v2ex: {
    id: "v2ex", icon: "🅥", column: "tech",
    accentColor: "bg-gradient-to-r from-teal-500 to-green-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  solidot: {
    id: "solidot", icon: "🔬", column: "tech",
    accentColor: "bg-gradient-to-r from-violet-500 to-purple-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  pcbeta: {
    id: "pcbeta", icon: "🪟", column: "tech",
    accentColor: "bg-gradient-to-r from-blue-400 to-sky-300",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  linuxdo: {
    id: "linuxdo", icon: "🐧", column: "tech",
    accentColor: "bg-gradient-to-r from-yellow-500 to-orange-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  github: {
    id: "github", icon: "🐙", column: "tech",
    accentColor: "bg-gradient-to-r from-gray-500 to-gray-700",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  hackernews: {
    id: "hackernews", icon: "🔶", column: "tech",
    accentColor: "bg-gradient-to-r from-orange-500 to-yellow-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  // ── Finance ────────────────────────────────────────────
  wallstreetcn: {
    id: "wallstreetcn", icon: "📈", column: "finance",
    accentColor: "bg-gradient-to-r from-amber-500 to-yellow-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  xueqiu: {
    id: "xueqiu", icon: "❄️", column: "finance",
    accentColor: "bg-gradient-to-r from-sky-500 to-blue-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  cls: {
    id: "cls", icon: "📡", column: "finance",
    accentColor: "bg-gradient-to-r from-red-500 to-rose-400",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  gelonghui: {
    id: "gelonghui", icon: "💹", column: "finance",
    accentColor: "bg-gradient-to-r from-amber-500 to-orange-400",
    interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  jin10: {
    id: "jin10", icon: "🥇", column: "finance",
    accentColor: "bg-gradient-to-r from-yellow-400 to-amber-300",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  mktnews: {
    id: "mktnews", icon: "📊", column: "finance",
    accentColor: "bg-gradient-to-r from-cyan-500 to-blue-400",
    interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
  },
  // ── Global ─────────────────────────────────────────────
  googletrends: {
    id: "googletrends", icon: "🔍", column: "global",
    accentColor: "bg-gradient-to-r from-blue-500 to-green-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  bbc: {
    id: "bbc", icon: "🇬🇧", column: "global",
    accentColor: "bg-gradient-to-r from-red-600 to-red-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  cnn: {
    id: "cnn", icon: "📡", column: "global",
    accentColor: "bg-gradient-to-r from-red-700 to-red-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  theguardian: {
    id: "theguardian", icon: "🔵", column: "global",
    accentColor: "bg-gradient-to-r from-blue-700 to-cyan-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  reuters: {
    id: "reuters", icon: "📰", column: "global",
    accentColor: "bg-gradient-to-r from-orange-600 to-amber-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  apnews: {
    id: "apnews", icon: "🗺️", column: "global",
    accentColor: "bg-gradient-to-r from-slate-600 to-gray-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  reddit: {
    id: "reddit", icon: "👽", column: "global",
    accentColor: "bg-gradient-to-r from-orange-400 to-red-400",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  producthunt: {
    id: "producthunt", icon: "🐱", column: "global",
    accentColor: "bg-gradient-to-r from-rose-500 to-pink-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 20,
  },
  youtube: {
    id: "youtube", icon: "▶️", column: "global",
    accentColor: "bg-gradient-to-r from-red-500 to-pink-500",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  applemusic: {
    id: "applemusic", icon: "🎵", column: "global",
    accentColor: "bg-gradient-to-r from-pink-500 to-rose-400",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  steam: {
    id: "steam", icon: "🎮", column: "global",
    accentColor: "bg-gradient-to-r from-blue-700 to-indigo-500",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  devto: {
    id: "devto", icon: "👩‍💻", column: "global",
    accentColor: "bg-gradient-to-r from-violet-600 to-indigo-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // ── AI ─────────────────────────────────────────────────
  huggingface: {
    id: "huggingface", icon: "🤗", column: "ai",
    accentColor: "bg-gradient-to-r from-yellow-400 to-orange-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  openai: {
    id: "openai", icon: "🤖", column: "ai",
    accentColor: "bg-gradient-to-r from-emerald-500 to-teal-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  googleai: {
    id: "googleai", icon: "✨", column: "ai",
    accentColor: "bg-gradient-to-r from-blue-500 to-indigo-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 20,
  },
  tldrai: {
    id: "tldrai", icon: "⚡", column: "ai",
    accentColor: "bg-gradient-to-r from-violet-500 to-purple-400",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 20,
  },
  anthropic: {
    id: "anthropic", icon: "🧠", column: "ai",
    accentColor: "bg-gradient-to-r from-orange-500 to-amber-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  deepseek: {
    id: "deepseek", icon: "🐋", column: "ai",
    accentColor: "bg-gradient-to-r from-blue-600 to-cyan-500",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  doubao: {
    id: "doubao", icon: "🫘", column: "ai",
    accentColor: "bg-gradient-to-r from-blue-500 to-violet-500",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  qwen: {
    id: "qwen", icon: "💜", column: "ai",
    accentColor: "bg-gradient-to-r from-purple-600 to-violet-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  kimi: {
    id: "kimi", icon: "🌙", column: "ai",
    accentColor: "bg-gradient-to-r from-indigo-500 to-blue-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // ── Entertainment ─────────────────────────────────────
  "tmdb-movies": {
    id: "tmdb-movies", icon: "🎬", column: "entertainment",
    accentColor: "bg-gradient-to-r from-emerald-500 to-teal-400",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  "tmdb-tv": {
    id: "tmdb-tv", icon: "📽️", column: "entertainment",
    accentColor: "bg-gradient-to-r from-teal-500 to-emerald-400",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  anilist: {
    id: "anilist", icon: "🌸", column: "entertainment",
    accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // twitch: disabled (2FA blocker — needs non-CN phone to register a dev app)
  // ── Design (tech-adjacent) ────────────────────────────
  awwwards: {
    id: "awwwards", icon: "🏆", column: "tech",
    accentColor: "bg-gradient-to-r from-rose-500 to-pink-400",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  behance: {
    id: "behance", icon: "🎨", column: "tech",
    accentColor: "bg-gradient-to-r from-blue-600 to-indigo-500",
    interval: 60 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // ── Sports (global) ───────────────────────────────────
  bbcsport: {
    id: "bbcsport", icon: "⚽", column: "global",
    accentColor: "bg-gradient-to-r from-red-600 to-rose-500",
    interval: 15 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
  // ── Food (china) ──────────────────────────────────────
  bilifood: {
    id: "bilifood", icon: "🍜", column: "china",
    accentColor: "bg-gradient-to-r from-orange-500 to-red-400",
    interval: 30 * 60 * 1000, defaultCount: 10, expandCount: 25,
  },
}

export const SOURCE_IDS = Object.keys(sourceMeta)

// International-first order (default for non-zh locales)
export const SOURCE_IDS_EN: string[] = [
  // Global news
  "bbc", "reuters", "apnews", "cnn", "theguardian", "bbcsport",
  // Trends & discovery
  "googletrends", "reddit", "hackernews", "devto", "producthunt",
  // Entertainment & gaming
  "tmdb-movies", "tmdb-tv", "anilist",
  "youtube", "applemusic", "steam",
  // AI
  "openai", "anthropic", "googleai", "tldrai", "huggingface",
  "deepseek", "doubao", "qwen", "kimi",
  // Tech / design
  "github", "awwwards", "behance",
  // Finance
  "wallstreetcn",
  // Chinese content (at the end for EN users)
  "weibo", "baidu", "zhihu", "bilibili", "toutiao", "tieba", "douyin",
  "ifeng", "thepaper", "tencent", "nowcoder", "douban", "iqiyi", "bilifood",
  "zaobao", "cankaoxiaoxi", "sputniknewscn", "hupu",
  "36kr", "ithome", "sspai", "juejin", "v2ex", "solidot", "pcbeta", "linuxdo",
  "xueqiu", "cls", "gelonghui", "jin10", "mktnews",
]

// China-first order (default for zh locale)
export const SOURCE_IDS_ZH: string[] = [
  // China
  "weibo", "baidu", "zhihu", "bilibili", "toutiao", "tieba", "douyin",
  "ifeng", "thepaper", "tencent", "nowcoder", "douban", "iqiyi", "bilifood",
  // Tech / design
  "36kr", "ithome", "sspai", "juejin", "v2ex", "solidot", "pcbeta", "linuxdo",
  "github", "hackernews", "awwwards", "behance",
  // Finance
  "wallstreetcn", "xueqiu", "cls", "gelonghui", "jin10", "mktnews",
  // Chinese international news
  "zaobao", "cankaoxiaoxi", "sputniknewscn",
  // Global news
  "bbc", "reuters", "apnews", "cnn", "theguardian", "bbcsport",
  // Global platforms
  "googletrends", "reddit", "producthunt", "youtube", "devto", "applemusic", "steam", "hupu",
  // Entertainment
  "tmdb-movies", "tmdb-tv", "anilist",
  // AI
  "deepseek", "doubao", "qwen", "kimi",
  "openai", "anthropic", "googleai", "tldrai", "huggingface",
]
