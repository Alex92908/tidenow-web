# TideNow 设计到落地问题手册

从"聚合站"长成"聚合 + AI 写作 + 预测"全栈过程中踩过的坑与解决方案。
换电脑 / 隔一段时间回来续开发时,先读这份。

最后更新:2026-06-24

---

## 0. 换电脑 checklist（最重要,先做这个）

```bash
# 1. clone + 装前端依赖
git clone https://github.com/Alex92908/tidenow-web.git
cd tidenow-web
pnpm install            # 用 pnpm，不是 npm（两个 lockfile 都在，但一直用 pnpm）

# 2. ForeSight（Python）本地环境 —— 必须建 venv，不能用系统 python3
pnpm foresight:setup    # = 建 .venv + 装 api/requirements.txt
                        # .venv 已 gitignore，换电脑必须重建

# 3. 本地跑（普通开发，不带 ForeSight）
pnpm dev                # → http://localhost:3002

# 4. 本地跑（要测 ForeSight，两个终端）
pnpm foresight:dev:real # 终端1：ForeSight 服务（真预测，用请求带的 key）
pnpm dev:foresight      # 终端2：dev server 指向本地 ForeSight
```

### 本地 .env.local（可选，按需）
```
NEXT_PUBLIC_FORESIGHT_ENABLED=1   # 本地显示 🔮 开关（线上默认已开）
TMDB_API_KEY=...                  # 影视源需要
YOUTUBE_API_KEY=...               # YouTube 源需要
HTTPS_PROXY=...                   # 抓被墙的源时（Node fetch 默认忽略，代码里装了 undici ProxyAgent）
```

### 线上 Vercel 环境变量（生产必须的）
| 变量 | 值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://tide-now.com` | **裸域**（主域名改成裸域后必须设，否则 canonical 还指向 www） |
| `FORESIGHT_INTERNAL_TOKEN` | `openssl rand -hex 16` | 可选，锁 /api/predict 防陌生人白嫖算力 |
| （ForeSight 的 AI key） | 无需设 | ForeSight 复用用户 BYOK key，不需要独立 key |

---

## 1. 数据源的坑

### CLS 财联社 —— endpoint 改了 + 上了签名
- 症状:`/nodeapi/updateTelegraphList` 404
- 根因:2026 中改成 `/v1/roll/get_roll_list`,且每次请求要 `sign` 参数
- 解法:sha1(排序后的 query string) → md5 → 作 `&sign=`。见 `src/sources/cls.ts`

### 参考消息 —— TLS 证书过期
- 症状:Node fetch 报证书错
- 根因:`china.cankaoxiaoxi.com` 子域证书过期没续
- 解法:换 `www.cankaoxiaoxi.com`（同 JSON 路径，证书有效）。见 `src/sources/cankaoxiaoxi.ts`

### Reddit —— 匿名 API 永久 403
- 根因:Reddit 2024 起封死匿名 `.json`，必须 OAuth
- 现状:**已禁用**（index.ts / metadata.ts / i18n 都注释了，i18n 标签保留）
- 复活:申请 script 类型 app → Vercel 设 `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` → 取消 4 处注释

### 牛客 —— 地理封锁
- 根因:`gw-c.nowcoder.com` 只对中国大陆 IP 开放，Vercel 美国机房请求被静默吞
- 现状:**已禁用**
- 复活:接 CN 出口代理（HTTPS_PROXY），代码已支持 undici ProxyAgent

### TikTok —— 死路，别再试
- 结论:Vercel 上的 Node fetch **TLS 层就被 RST**（JA3/JA4 指纹检测），跟地理无关
- 证据:curl 能通，Node fetch `ECONNRESET`；tikwm 等镜像全被 Cloudflare 拦
- 唯一可行:curl-impersonate（Vercel 跑不了，Lambda 50MB 限制）/ Apify($0-5) / 自建 Fly.io 代理
- **决策:不接**。留作 backlog

---

## 2. ForeSight 集成的坑

### 语言:Python，不能并进 Next.js
- ForeSight 是 Python（2678 行，14 backend）。方案是 **Vercel Python Runtime**：
  - `api/predict.py`（BaseHTTPRequestHandler 模式，Vercel 标准）
  - `lib/foresight/`（整个包，vercel.json `includeFiles` 拉进函数）
  - `api/requirements.txt`（requests + pyyaml + anthropic，去掉了 akshare/PyQt6）

### vercel.json runtime 写法 —— 构建失败雷
- 症状:`Error: Function Runtimes must have a valid version`
- 根因:`"runtime": "@vercel/python@4"` 不是合法格式
- 解法:**删掉 runtime 行**，Vercel 自动识别 `api/*.py`。memory/maxDuration/includeFiles 保留

### maxDuration —— Hobby 计划
- 一度以为 Hobby 只有 10s，降到 10。后来确认 **Hobby 支持 60s**（Vercel 早改了）
- 现状:`maxDuration: 60`
- 残留风险:ForeSight(20-40s) + 写文章(20-50s) 串行可能 >60s。真超时了就拆两次往返

### venv —— 本地 python3 解析错乱
- 症状:`pnpm foresight:dev:real` 报 `ModuleNotFoundError: requests`
- 根因:交互终端的 python3 被 conda/pyenv shadow，跟装包的不是同一个
- 解法:项目本地 `.venv`，脚本用 `.venv/bin/python` 绝对路径调用。`pnpm foresight:setup` 重建

### BYOK —— 别搞两个 key
- 设计缺陷:一度让 ForeSight 读独立 `FORESIGHT_API_KEY`
- 修正:ForeSight **复用用户在 TideNow 填的那个 key**（compose 请求带的）
- provider 映射在 `api/predict.py` 的 `_PROVIDER_CFG`。Gemini/Nano 不支持（ForeSight LLM 只吃 OpenAI 兼容 + Anthropic）

### market 域 —— 无数据源
- 根因:quant backend 需要行情（akshare 已删 / 网页用户没法传 CSV）
- 解法:`/predict` 下拉移除 market；auto 路由到 market 时 **自动重做 scenario**（market fail-fast，重试仍 <60s）

### 联网搜索 —— 是"没重爬"不是"没联网"
- `search.py` 已接进 pipeline（Google News/Bing/DDG RSS，免 key），非 mock 非创作模式自动跑
- 报告里加了 `🌐 实时搜索：已联网，注入 N 条，最新 YYYY-MM-DD` 透明化行，一眼看出线上联网成没成
- 注意:数据新鲜度**看话题**（人民币破7 最新只到 2025-12，PMI 能到 2026-05），不是 bug

### swarm 立场语义 —— "反对 50%" 会误导
- 问题:舆情仿真把丰富舆论压成"支持/反对/观望"，但"反对什么"没定义 → "反对 50%" 被误读成"50% 黑小米"
- 解法:先提炼明确的"立场命题"，所有 persona 针对命题表态，报告写清"反对（对「XX类比恰当」）"

### 校准闭环 —— 【未解决，护城河】
- ForeSight 最大卖点是 Brier 校准，但 `predictions.jsonl` 在 Vercel /tmp 冷启动清空 → 准确率永远积累不起来
- 现状:单篇手动验证
- TODO:持久化（Vercel KV/Blob/Postgres）+ 判定流程。这是从"看着专业"到"可证明准"的关键

---

## 3. Compose 写作的坑

### 抓正文 —— 篇幅小的真因
- 根因链:只抓前 3 条 × 1200 字符 → 料薄 → AI 觉得撑不起 1800 字 → 主动写短
- 解法:**用户选几条抓几条**（materials.length）+ 每条 2500 字符 + 放宽 prompt 的"撑不起就写短"
- 抓不到正文的源（微博/抖音 JS 渲染）降级 title-only，是上游限制

### ForeSight 增强 prompt 的 3 个 bug（已修）
- 中文混进英文文章 → prompt："分析可能是中文，必须翻成文章语言"
- 编造假人名（John Doe）→ prompt："仿真角色是虚拟的，绝不当真人引用"
- 暴露 "ForeSight" 工具名 → prompt："不提工具名，自然融入"

### hydration mismatch —— localeCompare
- 症状:source chip 排序服务端/客户端不一致，React 报 hydration error
- 根因:`localeCompare` 无显式 locale，Node(en-US) vs 浏览器(zh-CN) 结果不同
- 解法:改用码点比较（`a < b ? -1 : ...`），确定性

### 移动端 —— 固定高度压塌
- 根因:3 栏 grid 的 `h-[calc(100vh-7rem)]` 在移动端 1 栏堆叠时把三段压成各 1/3
- 解法:`lg:h-...` 只桌面固定；移动端各段给真实高度（60vh/40vh），页面自然滚动

---

## 4. 部署 / 域名 / AdSense

### 主域名 + ads.txt
- AdSense 注册的是**裸域 tide-now.com**
- 一度主域名是 www，裸域 308 跳 www → 后来改成**裸域为主域名**，www 跳裸域
- ads.txt 现状:`tide-now.com/ads.txt` 直出 200，内容 `google.com, pub-2701427752265946, DIRECT, f08c47fec0942fa0`
- AdSense "Not found" = **没重爬**（不是配置错），等 Google 自己的节奏
- ⚠️ 主域名改裸域后，代码 canonical 还默认 www → **必须设 `NEXT_PUBLIC_SITE_URL=https://tide-now.com`**

### AdSense Approval —— low value content
- 根因:聚合站结构性问题（内容都是别人的、点击跳外站）
- 已做:trust pages（/privacy /about /contact，/terms 撤了）、/posts 编辑栏目、原创文章
- 现状:Getting ready（审核中）。**关键是持续产原创 /posts 内容**

### 泄露 key 提醒
- ForeSight 原项目 config.yaml 曾明文 commit DeepSeek key → 已改 `${FORESIGHT_API_KEY}` + gitignore
- TideNow repo 本身干净（grep 验证过无 key）

---

## 5. UI / 交互的坑

### 复制按钮挤标题
- 根因:独立复制按钮在 flex 里占 24px（即使 opacity-0 也占布局），标题被挤截断
- 解法:复制功能并进**分享按钮下拉菜单**（复制文字 / 复制链接），row 回到一个按钮

### 标题完整显示 + 可框选（SEO-safe）
- 去 `line-clamp-2` → 自适应高度（HTML 标题一直是全的，line-clamp 纯 CSS 截断，SEO 无影响）
- `select-text` + onClick 选区判断（拖选时 preventDefault 不跳转）
- **标题仍是 `<a href>`，SEO 结构一字未动**

### 个性化 stale id
- 症状:禁用源后，"隐藏(1)" 计数和空列表不一致
- 解法:hydrate 时用当前 SOURCE_IDS 过滤 localStorage 里的失效 id，写回

---

## 6. 推广（backlog）

- Show HN 被软封（新账号），需养号 karma>100 / 4 周后再发
- Reddit 账号疑似被过滤，暂停推广，先养号
- 可发:V2EX 分享创造、即刻、小红书、知乎、Product Hunt
- 已备好中英文推广文案（完整版 + 短版 + X 版），见对话记录 / 可另存
- 差异化卖点:跨源聚类、AI 大厂列（9 源）、ForeSight 会公开打分

---

## 7. 未解决 / 下一步

| 事项 | 优先级 | 说明 |
|---|---|---|
| ForeSight 校准闭环持久化 | 高 | 护城河，Brier 分数积累 |
| 每周写 1-2 篇 /posts | 高 | AdSense + 内容飞轮 |
| 移动端 PWA | 中 | manifest + service worker 还没做 |
| TikTok 接入 | 低 | 除非愿意付 Apify/Fly.io |
| Compose 拆两次往返 | 低 | 若 ForeSight+写文章常超 60s 再做 |
| /source 详情页也加复制按钮 | 低 | 现在只有分享 |
