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
