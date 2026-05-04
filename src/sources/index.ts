import * as github from "./github"
import * as bilibili from "./bilibili"
import * as weibo from "./weibo"
import * as youtube from "./youtube"
import * as hackernews from "./hackernews"
import * as reddit from "./reddit"
import * as zhihu from "./zhihu"
import * as producthunt from "./producthunt"
import * as kr36 from "./36kr"
import * as ithome from "./ithome"
import * as baidu from "./baidu"
import * as spotify from "./spotify"
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
import * as kaopu from "./kaopu"
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
  kaopu,
  // Global
  googletrends,
  bbc,
  cnn,
  theguardian,
  reuters,
  apnews,
  reddit,
  producthunt,
  youtube,
  spotify,
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
} as const

export type SourceId = keyof typeof sources
