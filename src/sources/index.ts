import * as github from "./github"
import * as bilibili from "./bilibili"
import * as weibo from "./weibo"
import * as youtube from "./youtube"
import * as hackernews from "./hackernews"
import * as reddit from "./reddit"
import * as twitter from "./twitter"
import * as zhihu from "./zhihu"
import * as producthunt from "./producthunt"
import * as kr36 from "./36kr"
import * as ithome from "./ithome"
import * as baidu from "./baidu"
import * as applemusic from "./applemusic"
import * as toutiao from "./toutiao"
import * as tieba from "./tieba"
import * as v2ex from "./v2ex"
import * as douban from "./douban"
import * as sspai from "./sspai"
import * as wallstreetcn from "./wallstreetcn"
import * as juejin from "./juejin"
import * as thepaper from "./thepaper"
import * as steam from "./steam"
import * as hupu from "./hupu"
import * as iqiyi from "./iqiyi"
import * as xueqiu from "./xueqiu"
import * as douyin from "./douyin"
import * as ifeng from "./ifeng"
import * as nowcoder from "./nowcoder"
import * as tencent from "./tencent"
import * as solidot from "./solidot"
import * as pcbeta from "./pcbeta"
import * as linuxdo from "./linuxdo"
import * as cls from "./cls"
import * as gelonghui from "./gelonghui"
import * as jin10 from "./jin10"
import * as mktnews from "./mktnews"
import * as zaobao from "./zaobao"
import * as cankaoxiaoxi from "./cankaoxiaoxi"
import * as sputniknewscn from "./sputniknewscn"
// kaopu disabled — upstream feed stays stale even with 48h filter
// import * as kaopu from "./kaopu"
import * as googletrends from "./googletrends"
import * as devto from "./devto"
import * as huggingface from "./huggingface"
import * as openai from "./openai"
import * as googleai from "./googleai"
import * as tldrai from "./tldrai"
import * as anthropic from "./anthropic"
import * as deepseek from "./deepseek"
import * as doubao from "./doubao"
import * as qwen from "./qwen"
import * as kimi from "./kimi"
import * as bbc from "./bbc"
import * as cnn from "./cnn"
import * as theguardian from "./theguardian"
import * as reuters from "./reuters"
import * as apnews from "./apnews"
import * as anilist from "./anilist"
import * as tmdbMovies from "./tmdb-movies"
import * as tmdbTv from "./tmdb-tv"
import * as awwwards from "./awwwards"
import * as behance from "./behance"
import * as bbcsport from "./bbcsport"
import * as bilifood from "./bilifood"
// twitch source file kept in src/sources/ for future use, not registered here.

export const sources = {
  // China
  weibo,
  baidu,
  zhihu,
  bilibili,
  toutiao,
  tieba,
  douyin,
  ifeng,
  thepaper,
  tencent,
  nowcoder,
  douban,
  iqiyi,
  // Tech
  "36kr": kr36,
  ithome,
  sspai,
  juejin,
  v2ex,
  solidot,
  pcbeta,
  linuxdo,
  github,
  hackernews,
  // Finance
  wallstreetcn,
  xueqiu,
  cls,
  gelonghui,
  jin10,
  mktnews,
  // Sports/Entertainment
  hupu,
  steam,
  // World
  zaobao,
  cankaoxiaoxi,
  sputniknewscn,
  // kaopu — disabled (stale upstream)
  // Global
  googletrends,
  bbc,
  cnn,
  theguardian,
  reuters,
  apnews,
  reddit,
  twitter,
  producthunt,
  youtube,
  applemusic,
  devto,
  // AI
  huggingface,
  openai,
  googleai,
  tldrai,
  anthropic,
  deepseek,
  doubao,
  qwen,
  kimi,
  // Entertainment
  "tmdb-movies": tmdbMovies,
  "tmdb-tv": tmdbTv,
  anilist,
  // twitch — disabled until a non-CN phone is available to clear 2FA
  // Design (tech-adjacent)
  awwwards,
  behance,
  // Sports
  bbcsport,
  // Chinese food (Bilibili 美食区)
  bilifood,
} as const

export type SourceId = keyof typeof sources
