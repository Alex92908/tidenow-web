// Release notes data. Keep newest first. Each entry is rendered bilingually.
// Add a new release by prepending to RELEASES.

export type ChangeKind = "feat" | "fix" | "polish" | "infra"

export interface ChangeEntry {
  kind: ChangeKind
  en: string
  zh: string
}

export interface Release {
  version: string
  /** ISO date, e.g. "2026-05-21" */
  date: string
  title: { en: string; zh: string }
  changes: ChangeEntry[]
}

export const RELEASES: Release[] = [
  {
    version: "0.6.0",
    date: "2026-05-25",
    title: {
      en: "Thumbnails almost everywhere",
      zh: "几乎全员上图",
    },
    changes: [
      {
        kind: "feat",
        en: "Every card row now shows a small thumbnail when the source provides one — movie posters, album art, news photos, video stills, GitHub avatars, even per-link favicons for Hacker News.",
        zh: "每张卡的每条新闻现在都会显示缩略图（如果源给的话）——电影海报、专辑封面、新闻配图、视频封面、GitHub 头像，连 Hacker News 都用了目标网站的 favicon。",
      },
      {
        kind: "feat",
        en: "30+ sources extract images: TMDB Movies/TV, AniList, Apple Music, Bilibili, Bilibili Food, Douyin, Toutiao, Tieba, ThePaper, Baidu, Tencent, iFeng, sspai, Douban, Linux.do, BBC, BBC Sport, CNN, Reuters, AP, Guardian, Awwwards, Behance, Product Hunt, Reddit, YouTube, Steam, V2EX, Juejin, 36kr, iQiyi, Hugging Face papers.",
        zh: "30+ 源开始提图：TMDB 电影/剧、AniList、Apple Music、B站、B站美食、抖音、头条、贴吧、澎湃、百度、腾讯、凤凰、少数派、豆瓣、Linux.do、BBC、BBC Sport、CNN、Reuters、AP、卫报、Awwwards、Behance、Product Hunt、Reddit、YouTube、Steam、V2EX、掘金、36氪、爱奇艺、HuggingFace 论文。",
      },
      {
        kind: "fix",
        en: "Card image referrer policy switched to strict-origin-when-cross-origin so hotlink-protected CDNs (Douban being the loudest) actually serve their images.",
        zh: "卡片图片 referrer 策略改成 strict-origin-when-cross-origin，让带防盗链的 CDN（豆瓣最典型）能正常加载。",
      },
      {
        kind: "polish",
        en: "Thumbnails are lazy-loaded and gracefully hide on 404 — no broken-image placeholders.",
        zh: "缩略图按需懒加载，加载失败自动隐藏，不会留破图占位。",
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-05-22",
    title: {
      en: "Entertainment column & 6 new sources",
      zh: "新增「娱乐」分类和 6 个源",
    },
    changes: [
      {
        kind: "feat",
        en: "New \"Entertainment / 娱乐\" tab in the top filter bar.",
        zh: "顶部分类栏新增「娱乐 / Entertainment」tab。",
      },
      {
        kind: "feat",
        en: "TMDB Movies + TV trending (needs TMDB_API_KEY env var).",
        zh: "TMDB 电影 + 剧集每日热门榜（需要 TMDB_API_KEY 环境变量）。",
      },
      {
        kind: "feat",
        en: "AniList trending anime — no auth, public GraphQL.",
        zh: "AniList 番剧热度榜——免 key，公开 GraphQL。",
      },
      {
        kind: "feat",
        en: "Awwwards (blog feed) and Behance for design inspiration.",
        zh: "Awwwards（blog feed）和 Behance 设计灵感。",
      },
      {
        kind: "feat",
        en: "BBC Sport for sports headlines (replaces ESPN which blocked non-browser clients).",
        zh: "BBC Sport 体育头条（替代被屏蔽非浏览器请求的 ESPN）。",
      },
      {
        kind: "feat",
        en: "Bilibili Food (美食区) trending videos, via the official region API.",
        zh: "B站美食区热门视频，使用官方 region 接口。",
      },
      {
        kind: "polish",
        en: "Bilibili Hot now shows trending videos (with thumbnails) instead of just hot search keywords.",
        zh: "B站热门从「热搜词」改成「全站热门视频」，每条都有视频封面。",
      },
      {
        kind: "fix",
        en: "AI summary button (✦) restored in the header — was hidden during the launch period out of trust concerns.",
        zh: "AI 摘要按钮（✦）回到 header——之前出于信任考虑临时下线。",
      },
      {
        kind: "infra",
        en: "Kaopu News disabled — upstream stays stale even with the 48h filter. Source file kept for future reuse.",
        zh: "靠谱新闻下线——上游内容即便加 48 小时过滤后依然太旧。源文件保留备用。",
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-05-21",
    title: {
      en: "Personalized layout",
      zh: "个性化布局",
    },
    changes: [
      {
        kind: "feat",
        en: "Star sources you actually read — a new 'Pinned' tab shows only those.",
        zh: "给常看的源点 ★，新的「自选」tab 只显示打过星的。",
      },
      {
        kind: "feat",
        en: "Hide sources you don't care about with ✕. A dedicated 'Hidden' tab lets you restore them any time.",
        zh: "点 ✕ 把不感兴趣的源藏起来，最后一个「隐藏」tab 可以随时恢复。",
      },
      {
        kind: "feat",
        en: "Drag cards to reorder. Sidebar and main view share a single order — drag in either, the other updates.",
        zh: "拖拽卡片自由排序。sidebar 和主页面共用同一份顺序，拖一边另一边立刻同步。",
      },
      {
        kind: "feat",
        en: "Mobile long-press + keyboard sorting via @dnd-kit/sortable. Edge auto-scroll built in.",
        zh: "移动端长按 / 键盘排序都支持（@dnd-kit/sortable）。拖到边缘自动滚动。",
      },
      {
        kind: "feat",
        en: "Hide the 'Trending Across Sources' panel if you don't need it. One-click 'Reset layout' button restores all defaults.",
        zh: "多源热议面板可以隐藏。tab 栏右侧 ↺「重置布局」一键恢复所有自定义。",
      },
      {
        kind: "infra",
        en: "New per-source landing pages at /source/[id] — sitemap grew from 2 to ~112 URLs.",
        zh: "新增每个源的独立页面 /source/[id]，sitemap 从 2 条 URL 扩到 ~112 条。",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-19",
    title: {
      en: "RSS subscriptions & polish",
      zh: "RSS 订阅与打磨",
    },
    changes: [
      {
        kind: "feat",
        en: "Add your own RSS / Atom feeds via the '+ RSS' button.",
        zh: "通过「+ RSS」按钮添加你自己的 RSS / Atom 订阅。",
      },
      {
        kind: "feat",
        en: "Header gets a Feedback link (mailto). AI summary settings entry temporarily hidden — coming back later as a proxied service.",
        zh: "header 加了反馈链接。AI 摘要的设置入口暂时下线（后续改成代理服务，用户不用自己出 key）。",
      },
      {
        kind: "fix",
        en: "Locale-aware time formatting — no more 'Updated 刚刚 / just now ago' duplication.",
        zh: "时间显示按语言本地化，不再出现「Updated 刚刚 / just now ago」这种混排。",
      },
      {
        kind: "fix",
        en: "SSR-cached sources older than their TTL refresh in the background automatically.",
        zh: "SSR 缓存过期的源在后台自动刷新。",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-05-18",
    title: {
      en: "Custom domain & Apple Music",
      zh: "自定义域名 + Apple Music",
    },
    changes: [
      {
        kind: "infra",
        en: "Moved from tidenow-web.vercel.app to www.tide-now.com. Cloudflare DNS + auto SSL.",
        zh: "从 tidenow-web.vercel.app 搬到 www.tide-now.com。Cloudflare DNS + 自动 SSL。",
      },
      {
        kind: "feat",
        en: "Replaced Spotify chart (scraped, going stale) with Apple Music official RSS. Switch between Songs/Albums × US/UK/JP/中文区 in a single card.",
        zh: "Spotify 榜单（爬虫源、数据陈旧）换成 Apple Music 官方 RSS。一张卡里切单曲/专辑 × 美/英/日/中文区。",
      },
      {
        kind: "polish",
        en: "Default theme switched from dark to light. Background simplified to white.",
        zh: "默认主题从暗色改成浅色，背景调成纯白。",
      },
      {
        kind: "fix",
        en: "Server fetch now honors HTTPS_PROXY / HTTP_PROXY env vars (Node fetch ignores them by default).",
        zh: "服务端 fetch 现在认 HTTPS_PROXY / HTTP_PROXY 环境变量（Node 内置 fetch 默认不读）。",
      },
      {
        kind: "fix",
        en: "Kaopu News now sorted by publish date desc and filtered to the last 48h.",
        zh: "靠谱新闻按发布时间倒序，只显示近 48 小时内的条目。",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-05-06",
    title: {
      en: "Initial launch",
      zh: "首发",
    },
    changes: [
      {
        kind: "feat",
        en: "50+ trending sources aggregated in one page: HN, Reddit, GitHub, Product Hunt, Apple Music, Hugging Face papers, BBC, Reuters, AP, plus a chunk of Chinese sources (Weibo, Zhihu, Bilibili, 36kr, etc).",
        zh: "50+ 信息源一站聚合：HN、Reddit、GitHub、Product Hunt、Apple Music、Hugging Face、BBC、Reuters、AP，以及微博、知乎、B站、36kr 等中文源。",
      },
      {
        kind: "feat",
        en: "Cross-source trending: stories that appear on multiple sites get surfaced at the top with source badges.",
        zh: "跨源热点：同一话题在多个站点同时上榜会被单独抽出来放在顶部，并标注来源。",
      },
      {
        kind: "feat",
        en: "Hover any headline to get a 1-2 sentence AI summary. Bring your own OpenAI / Anthropic / Gemini / DeepSeek key — keys never leave the browser.",
        zh: "鼠标 hover 标题自动生成 1-2 句 AI 摘要（OpenAI / Anthropic / Gemini / DeepSeek 任选，自带 key，零成本，key 不离开浏览器）。",
      },
      {
        kind: "feat",
        en: "Bilingual (English / Chinese), light + dark themes, mobile-responsive.",
        zh: "中英双语，亮 / 暗双主题，移动端适配。",
      },
      {
        kind: "feat",
        en: "Chrome extension that turns the new-tab page into TideNow.",
        zh: "Chrome 扩展把新标签页变成 TideNow。",
      },
    ],
  },
]
