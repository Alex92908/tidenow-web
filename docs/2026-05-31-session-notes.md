# 2026-05-31 会话笔记

今天主要工作:AI 可发现性增强 + 加 Twitter 趋势 + TikTok 调研 + AdSense 拒信分析。

---

## 1. AI 可发现性批次(已提交 `e4f29b2`)

**问题**:站点上线后,如何让 AI 助手(ChatGPT、Claude、Perplexity)在用户提问时能引用到 TideNow?

**解决**:6 件事一起推:

| 改动 | 文件 | 作用 |
|---|---|---|
| 新增 `/llms.txt` | `src/app/llms.txt/route.ts` | llmstxt.org 约定的 LLM 友好站点描述 |
| robots.txt 显式 allow 16 个 AI/搜索爬虫 | `src/app/robots.ts` | GPTBot、ClaudeBot、PerplexityBot、Google-Extended、Applebot-Extended 等 |
| 首页 JSON-LD 升级为 @graph | `src/app/[locale]/page.tsx` | WebSite + CollectionPage + ItemList(60+ 源 URL) |
| 详情页加 CollectionPage JSON-LD | `src/app/[locale]/source/[id]/page.tsx` | 当前 Top 25 条结构化数据 |
| API 加 CORS | `src/app/api/sources/[id]/route.ts` | `Access-Control-Allow-Origin: *` + OPTIONS handler |
| 重写 README | `README.md` | 真实项目说明 + JSON API 文档 |

**预期效果**:短期没变化(1-4 周),中期(1-3 个月)被 AI 引用概率上升,但**真正能带量的还是 Show HN / Reddit / V2EX**,SEO 优化只是地基。

---

## 2. Show HN 被软封(Show HN restricted)

**问题**:dang 回信"new account, Show HN temporarily restricted"。

**根因**:HN 反 AI vibe-coding 泛滥,新账号 Show HN 直接进 shadowban。

**对策**:
- **路线 A(养号)**:刷 HN 评论,karma 到 50-100,4 周后再发
- **路线 B(改道)**:V2EX + 即刻先发,周末发 Reddit r/SideProject
- **路线 C(申诉)**:邮件 hn@ycombinator.com,几率小

推荐 A+B 双线。

---

## 3. Twitter 趋势源(已提交 `2228128`)

**问题**:Twitter 官方 v2 API 把 trends endpoint 砍了,要 $5000/月才有。

**解决**:抓 `trends24.in/united-states/`
- 第一个 `<ol class="trend-card__list">` 就是最新一小时快照
- 正则解析 `<a class=trend-link>` 拿话题词 + 链回 X 搜索
- 30 分钟缓存(trends24 本身就是小时级)
- 实测 50 条美国趋势返回 OK

**新建文件**:`src/sources/twitter.ts`(40 行)

**已知 trade-offs**:
- 依赖 trends24.in 可用性,挂了我们也挂
- 只有美国趋势(其他地区单建源即可)
- 没有 tweet 数(trends24 留给客户端 JS 渲染,我们拿不到)

---

## 4. TikTok 调研:确认死路

**问题**:能不能跟抖音一样,从 Vercel 直接 fetch TikTok 拿热榜?

**调研过程**(17 个端点 + 6 个聚合站全测了):

| 尝试 | 结果 |
|---|---|
| tikwm.com 直接 fetch | Cloudflare TLS 拦截 |
| TikTok 官方 `/aweme/v1/web/hot/search/list/`(抖音同款路径) | 403 / 需签名 |
| TikTok Creative Center API | `no permission` |
| RSSHub 公共实例 | 全离线 |
| 各类第三方 dashboard | 死 / 付费 / 需登录 |

**关键诊断**——做了 TLS 层 deep probe:

```
DNS: 解析正常
Raw TLS handshake → ECONNRESET
https.request → ECONNRESET
fetch → ECONNRESET (cause)
```

**根因**:TikTok 在 TCP/TLS 层就 RST 重置 Node fetch 的连接。**不是地理、不是 IP、不是 path,是 TLS ClientHello 指纹**(JA3/JA4)。

**对比验证**:同一台机器同一 IP

| 客户端 | tiktok.com | douyin.com |
|---|---|---|
| `curl` | ✅ 200 | ✅ 200 |
| `node fetch` | ❌ ECONNRESET | ✅ 200 |

抖音不做 TLS 指纹过滤(GFW 已经替它挡了),TikTok 做。

**尝试绕过**:Chrome cipher 列表 + h2 ALPN
- ✅ TLS 握手能通(`ECONNRESET` → `HPE_INVALID_CONSTANT`,说明数据流到了应用层)
- ❌ 但 HTTP/2 解析失败 + Cloudflare 后面还有 JS 浏览器挑战

**完整绕过链路 = curl-impersonate**,但:
- 编译后 60-80MB,Vercel Lambda 50MB 限制超了
- Vercel Edge runtime 不支持子进程
- **Vercel 跑不了**

**可行路线**:

| 方案 | 月成本 | 工程量 |
|---|---|---|
| Apify(`clockworks/free-tiktok-scraper`) | $0-5(免费额度内) | 30 分钟 |
| 自建 Fly.io + curl_cffi 代理 | $0-5(免费 tier) | 半天 |
| TikHub / RapidAPI 付费 | $10-30 | 30 分钟 |
| **不接 TikTok** | $0 | 0 |

**决策**:暂时不接。Twitter 已经够了,TikTok 留作 backlog。

---

## 5. AdSense 拒信:"Low value content"

**问题**:tide-now.com 被 AdSense 拒,原因"Low value content"。

**根因**(从 AdSense 视角):
- 卡片标题/缩略图都是别人的
- 用户点链接 = 跳外站
- 每个页面"原创内容"几乎为零
- 这是聚合站的**结构性问题**,不是改个文案能修

**三条路**:

### A. 换网络(最现实)
- **Ezoic** — 几乎没门槛,接聚合站,RPM $1-8
- MGID / Outbrain — 推荐位广告
- ❌ Mediavine 需要 5 万 sessions/月,够不上
- ❌ AdSterra / PropellerAds 广告质量太差,不推荐

### B. 增加原创内容,30 天后重申
1. 每周一篇"This Week in Trending"编辑摘要(双语)
2. 给 60+ 源各加 50-200 字编辑描述(≈ 6000 字原创)
3. 5-10 篇 SEO 长文("中国十大热榜对比"之类)
4. 加 About / Privacy / Terms / FAQ 页

工程量:**1-2 个周末,持续 1 个月**。

### C. 不接广告(我的真实推荐)
- 站还小,即使过了 RPM 也才 $1-3,月收入 $10-30,可能扣 Vercel 成本后倒贴
- 拒信反而**保护了产品"无广告、纯净"的卖点**
- 想赚钱的合理路径是流量起来后:私单广告 / Pro 订阅

**当前决策**:待定,等用户决定走 B 还是 C。

---

## 提交总结

| Commit | 内容 |
|---|---|
| `e4f29b2` | AI search discoverability (llms.txt, JSON-LD, CORS, AI bots) |
| `2228128` | X (Twitter) trends source via trends24.in |

## 未完成 / Backlog

- [ ] TikTok:如果以后愿意付 $5/月,接 Apify 或部署 Fly.io 代理
- [ ] HN 养号 4 周后再发 Show HN
- [ ] V2EX + 即刻 + Reddit r/SideProject 推广
- [ ] AdSense 决定:走 Ezoic 还是放弃广告
- [ ] 如果选编辑内容路线:写 source 描述 + Weekly Trending
