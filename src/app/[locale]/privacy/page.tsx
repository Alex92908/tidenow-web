import type { Metadata } from "next"
import Link from "next/link"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

// Static legal/trust pages — content changes maybe once a year. A 7-day
// revalidate keeps the page fully cached at the edge while still giving
// us a path to push corrections without a redeploy.
export const revalidate = 604_800

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const title = locale === "zh" ? "隐私政策 | TideNow" : "Privacy Policy | TideNow"
  const description =
    locale === "zh"
      ? "TideNow 不设账号、不存数据。这一页说清楚我们具体做了什么和不做什么。"
      : "TideNow has no accounts and no user database. This page documents what we do and explicitly don't do with your data."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/privacy` : `${SITE_URL}/privacy`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/privacy`,
        "zh-Hans": `${SITE_URL}/zh/privacy`,
        "x-default": `${SITE_URL}/privacy`,
      },
    },
    openGraph: { type: "article", url: canonical, title, description },
  }
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const lang: "en" | "zh" = locale === "zh" ? "zh" : "en"
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <nav className="text-xs text-gray-400 dark:text-zinc-600 mb-6">
        <Link
          href={lang === "zh" ? "/zh" : "/"}
          className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
        >
          ← TideNow
        </Link>
      </nav>

      {lang === "zh" ? <PrivacyZh /> : <PrivacyEn />}

      <p className="mt-12 pt-6 border-t border-gray-100 dark:border-white/[0.04] text-xs text-gray-400 dark:text-zinc-600">
        {lang === "zh" ? "上次更新:2026-06-08" : "Last updated: 2026-06-08"}
      </p>
    </main>
  )
}

function PrivacyEn() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>Privacy Policy</h1>
      <p>
        TideNow is a public read-only aggregator of 60+ trending feeds. It
        has no accounts, no login, no user database, and no per-user
        identifiers under our control. This page documents exactly what
        happens to your data.
      </p>

      <h2>What we don't collect</h2>
      <ul>
        <li>No name, email, phone, or other identity fields. There is no
          sign-up form anywhere on the site.</li>
        <li>No password storage. There is no password.</li>
        <li>No persistent user ID issued by us. We do not write any
          identifying cookie on first visit.</li>
        <li>No payment information. The service is free; we never charge.</li>
        <li>No tracking pixels from third-party ad networks.</li>
      </ul>

      <h2>What lives only on your device</h2>
      <p>
        Your personalisation lives entirely in your browser's
        <code>localStorage</code> — nothing is sent to us. This includes:
      </p>
      <ul>
        <li>Pinned / hidden sources and your custom card order.</li>
        <li>Keyword mute list, theme preference, font size, locale.</li>
        <li>Compose tool drafts (up to 20 entries).</li>
        <li>Your AI provider name + API key (if you set one in the AI
          settings panel).</li>
      </ul>
      <p>
        Clearing your browser data deletes all of it irrevocably. We have
        no backup because we never received a copy. An import / export
        JSON button in the Compose drafts panel is the only escape hatch
        if you want to move between devices.
      </p>

      <h2>What we do collect (and why)</h2>
      <ul>
        <li><strong>Vercel Analytics</strong> — anonymous, aggregated
          page-view counts and approximate country / browser. No personal
          identifiers, no fingerprinting. We use it to know which pages
          users actually read.</li>
        <li><strong>Vercel logs</strong> — standard server logs (IP,
          user-agent, request path) retained for 24 hours for debugging
          and abuse prevention. Never exported, never sold, automatically
          deleted.</li>
        <li><strong>Server-side cache</strong> — we cache upstream feed
          responses (HN, Reddit, Weibo, etc.) for 5–60 minutes so we
          don't hammer the publishers. This cache contains the headlines
          themselves, not anything about who requested them.</li>
        <li><strong>AI summary cache</strong> — when you hover for an AI
          summary, the result is cached by a SHA1 hash of
          <code>provider:locale:headline</code> so identical hovers
          across all users hit a single record. The cache key contains
          no per-user information.</li>
      </ul>

      <h2>Your AI key (BYOK)</h2>
      <p>
        The AI summary and Compose tool use a "bring your own key"
        pattern. When you submit a request, our server forwards your key
        and prompt to your chosen AI provider (OpenAI, Anthropic,
        DeepSeek, Zhipu, or Google Gemini), receives the response, and
        returns it to your browser.
      </p>
      <p>
        Your key is transmitted over HTTPS, used for that single request,
        and never written to disk or any database we control. It also
        lives in your browser's <code>localStorage</code> until you
        clear it. We strongly recommend creating a per-site key with
        a tight spending limit at your AI provider, rather than reusing
        your primary key.
      </p>
      <p>
        If you use on-device Gemini Nano (Chrome 139+ with the flag), the
        request never leaves your browser at all.
      </p>

      <h2>Advertising</h2>
      <p>
        We're applying for Google AdSense. If accepted, AdSense and its
        partners may set their own cookies on your browser to serve and
        measure ads. AdSense's privacy policy applies in addition to this
        one:
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
          {" "}policies.google.com/technologies/ads
        </a>. You can opt out of personalised ads at:
        <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">
          {" "}google.com/settings/ads
        </a>.
      </p>

      <h2>External links</h2>
      <p>
        Every card on the site links to the original publisher. We're not
        responsible for the privacy practices, content, or accuracy of
        anything you click through to.
      </p>

      <h2>Children</h2>
      <p>
        TideNow is not directed at children under 13. We do not knowingly
        collect data from them — but since we collect almost nothing from
        anyone, this is enforced by design more than by policy.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we'll update the "Last updated" date at
        the bottom of this page. Significant changes (e.g. introducing
        accounts, adding a third-party tracker) will also appear in the
        <Link href="/changelog">{" "}changelog</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, concerns, or data-removal requests:
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>.
      </p>
    </article>
  )
}

function PrivacyZh() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>隐私政策</h1>
      <p>
        TideNow 是一个聚合 60+ 个公开热榜的只读站点。无账号、无登录、无服务端用户数据库,也不在我方下发任何标识符。本页详述你的数据具体如何被处理。
      </p>

      <h2>我们不收集的</h2>
      <ul>
        <li>不收集姓名、邮箱、手机号或其他身份信息。**站内任何位置都没有注册入口**。</li>
        <li>不存储密码——根本没有密码。</li>
        <li>不下发任何"我方颁发"的用户 ID。首次访问不写任何识别用 cookie。</li>
        <li>不收支付信息。服务永久免费。</li>
        <li>不嵌入任何第三方广告网络的追踪像素。</li>
      </ul>

      <h2>仅存在于你浏览器本地的</h2>
      <p>
        你的个性化全部存在浏览器 <code>localStorage</code> 中,**不上传**到我方服务器。包括:
      </p>
      <ul>
        <li>置顶 / 隐藏的源、自定义卡片顺序。</li>
        <li>关键词屏蔽列表、主题、字号、语言偏好。</li>
        <li>Compose 写作工具的草稿(上限 20 条)。</li>
        <li>你的 AI 服务商名 + API key(若在 AI 设置面板配置过)。</li>
      </ul>
      <p>
        清空浏览器数据将不可逆地删除以上所有内容。我方**没有备份**,因为我方从未收到过副本。Compose 草稿面板里的导入/导出 JSON 按钮是跨设备转移的唯一通道。
      </p>

      <h2>我们会收集的(说明用途)</h2>
      <ul>
        <li><strong>Vercel Analytics</strong> —— 匿名、聚合的页面访问量和大致国家/浏览器分布。无个人标识、无指纹追踪。我们用它了解哪些页面真的有人看。</li>
        <li><strong>Vercel 服务器日志</strong> —— 标准日志(IP、User-Agent、请求路径),保留 24 小时供调试和反滥用。**不导出、不出售**,到期自动删除。</li>
        <li><strong>上游缓存</strong> —— 缓存上游(HN、Reddit、微博等)接口响应 5-60 分钟,避免对发布方过度请求。缓存内容只是标题本身,与请求者无关。</li>
        <li><strong>AI 摘要缓存</strong> —— hover 触发 AI 摘要时,结果按 <code>provider:locale:headline</code> 的 SHA1 哈希缓存,**所有用户相同 hover 共享同一条记录**。缓存键不含任何用户信息。</li>
      </ul>

      <h2>你的 AI key(BYOK)</h2>
      <p>
        AI 摘要和 Compose 写作工具使用"自带 API key"模式。提交请求时,服务端把你的 key 和 prompt 转发到你指定的 AI 服务商(OpenAI、Anthropic、DeepSeek、智谱、Google Gemini),收到响应后返回你的浏览器。
      </p>
      <p>
        你的 key 通过 HTTPS 传输,**仅用于该次单个请求**,不写入任何我方控制的磁盘或数据库。同时它存在浏览器 <code>localStorage</code> 中,清除前持续存在。**强烈建议**在你的 AI 服务商创建一个专门给本站使用、带紧支出限额的 key,而不要复用主 key。
      </p>
      <p>
        如果你使用浏览器内置的 Gemini Nano(Chrome 139+ 开启 flag),请求**完全不离开浏览器**。
      </p>

      <h2>广告</h2>
      <p>
        我们正在申请 Google AdSense。若获批,AdSense 及其合作方可能在你浏览器上设置自己的 cookie 用于投放和度量广告。除本政策外,亦适用 AdSense 的隐私政策:
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">
          {" "}policies.google.com/technologies/ads
        </a>。可在此关闭个性化广告:
        <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">
          {" "}google.com/settings/ads
        </a>。
      </p>

      <h2>外部链接</h2>
      <p>
        站内每张卡片都链向原始发布方。我们对你点击外链后所到达的站点的隐私实践、内容准确性概不负责。
      </p>

      <h2>未成年人</h2>
      <p>
        TideNow 不面向 13 岁以下儿童。我们不会主动收集他们的数据——但既然几乎不收任何人的数据,这一点是由设计保证的,不是由政策保证的。
      </p>

      <h2>变更</h2>
      <p>
        若本政策变更,本页底部"上次更新"日期会同步更新。重大变更(如引入账号系统、增加第三方追踪)将同时记入
        <Link href="/zh/changelog">{" "}更新日志</Link>。
      </p>

      <h2>联系</h2>
      <p>
        如有疑问、顾虑或数据删除请求:
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>。
      </p>
    </article>
  )
}
