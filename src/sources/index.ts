import * as github from "./github"
import * as bilibili from "./bilibili"
import * as weibo from "./weibo"
import * as youtube from "./youtube"
import * as hackernews from "./hackernews"
// Reddit disabled — anonymous /r/popular.json now 403s, OAuth client_credentials
// works but requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars + a
// dev-server restart to load them. Re-enable by uncommenting both lines below
// (here and in the registry) and providing the env vars.
// import * as reddit from "./reddit"
import * as twitter from "./twitter"
import * as zhihu from "./zhihu"
import * as producthunt from "./producthunt"
import * as kr36 from "./36kr"
import * as ithome from "./ithome"
import * as baidu from "./baidu"
import * as spotify from "./spotify"
import * as qqmusic from "./qqmusic"
import * as hongguo from "./hongguo"
import * as reelshort from "./reelshort"
import * as netease from "./netease"
import * as coingecko from "./coingecko"
import * as techcrunch from "./techcrunch"
import * as theverge from "./theverge"
import * as billboard from "./billboard"
import * as weread from "./weread"
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
// Nowcoder disabled — gw-c.nowcoder.com geo-restricts to mainland-China IPs;
// Vercel's US/EU function pool can't reach it. Re-enable by routing through
// a CN-resident proxy (HTTPS_PROXY env var; src/lib/fetch.ts already wires
// undici's ProxyAgent when it's set).
// import * as nowcoder from "./nowcoder"
import * as tencent from "./tencent"
import * as solidot from "./solidot"
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
import * as bbcsport from "./bbcsport"
import * as bilifood from "./bilifood"
import * as tidenowPosts from "./tidenow-posts"
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
  // nowcoder, — geo-blocked from Vercel; re-enable with CN proxy
  douban,
  iqiyi,
  qqmusic,
  hongguo,
  netease,
  weread,
  // Tech
  "36kr": kr36,
  ithome,
  sspai,
  juejin,
  v2ex,
  solidot,
  techcrunch,
  theverge,
  // pcbeta dropped 2026-11-15 — bbs.pcbeta.com serves a JS bot-check page
  // to server fetches (no working RSS endpoint); the card was permanently empty.
  github,
  hackernews,
  // Finance
  wallstreetcn,
  xueqiu,
  cls,
  gelonghui,
  jin10,
  mktnews,
  coingecko,
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
  // reddit, — anonymous API now 403s; re-enable with OAuth env vars
  twitter,
  producthunt,
  youtube,
  spotify,
  reelshort,
  billboard,
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
  // Sports
  bbcsport,
  // Chinese food (Bilibili 美食区)
  bilifood,
  // TideNow's own editorial posts — appears as just another source
  // card. Lives at the end of the registry / source-id lists so it
  // renders last by default; the user can pin or reorder freely.
  "tidenow-posts": tidenowPosts,
} as const

export type SourceId = keyof typeof sources
