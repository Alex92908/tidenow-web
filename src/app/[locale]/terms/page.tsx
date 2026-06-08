import type { Metadata } from "next"
import Link from "next/link"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

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
  const title = locale === "zh" ? "服务条款 | TideNow" : "Terms of Service | TideNow"
  const description =
    locale === "zh"
      ? "使用 TideNow 时适用的条款。简短、白话、没有律师含混话。"
      : "The terms that apply when you use TideNow. Short, plain-English, no lawyer fog."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/terms` : `${SITE_URL}/terms`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/terms`,
        "zh-Hans": `${SITE_URL}/zh/terms`,
        "x-default": `${SITE_URL}/terms`,
      },
    },
    openGraph: { type: "article", url: canonical, title, description },
  }
}

export default async function TermsPage({
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

      {lang === "zh" ? <TermsZh /> : <TermsEn />}

      <p className="mt-12 pt-6 border-t border-gray-100 dark:border-white/[0.04] text-xs text-gray-400 dark:text-zinc-600">
        {lang === "zh" ? "上次更新:2026-06-08" : "Last updated: 2026-06-08"}
      </p>
    </main>
  )
}

function TermsEn() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>Terms of Service</h1>
      <p>
        TideNow is a free, open-source side project run by an individual.
        Using the site means you agree to these short terms. If anything is
        unclear, email
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>.
      </p>

      <h2>What you're getting</h2>
      <p>
        A read-only aggregator that surfaces what's trending across 60+
        publishers, plus optional AI-assisted summary and writing tools
        that use your own API keys. Provided as-is, with no warranty,
        no SLA, no support contract.
      </p>

      <h2>The code is MIT, the content isn't</h2>
      <ul>
        <li>The TideNow application code is open source under the MIT
          licence. Repo:
          <a href="https://github.com/Alex92908/tidenow-web" target="_blank" rel="noopener noreferrer">
            {" "}github.com/Alex92908/tidenow-web
          </a>.
        </li>
        <li><strong>Aggregated headlines, thumbnails, and links displayed
          in the source cards belong to the original publishers</strong>
          (Hacker News, Reddit, BBC, Reuters, Weibo, etc.). TideNow
          surfaces them and links back; it does not claim ownership and
          does not republish them as our own.</li>
        <li>Editorial articles at <Link href="/posts">/posts</Link> are
          written by the TideNow team and are © their respective authors;
          fair-use quoting with attribution is fine, full republication
          is not.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Scrape the site at a rate that's clearly automated abuse.
          Reasonable use of the public JSON API at
          <code>/api/sources/&#123;id&#125;</code> is fine (it's CORS-
          enabled for that exact reason); aggressive scraping that
          impacts service for others isn't.</li>
        <li>Submit content to any input field (Compose drafts, AI
          prompts) that violates law, defames anyone, or contains
          malware payloads.</li>
        <li>Misuse the BYOK AI tooling to violate the upstream AI
          provider's terms — your own contract with OpenAI / Anthropic /
          DeepSeek / Google still applies.</li>
        <li>Attempt to reverse-engineer authentication that doesn't
          exist. (There are no accounts. There is nothing to
          reverse-engineer.)</li>
      </ul>

      <h2>The "as-is" part</h2>
      <p>
        TideNow is provided <strong>"as is" without warranty of any
        kind</strong>. We don't guarantee:
      </p>
      <ul>
        <li>Continuous uptime. Vercel sometimes goes down. Upstream feeds
          break and stay broken until we fix the scraper.</li>
        <li>Accuracy of any aggregated content. The original publishers
          are responsible for what they wrote; we're a window.</li>
        <li>Anything the AI generates. AI output may be incorrect,
          biased, or hallucinated. Always verify before publishing.</li>
        <li>Forever-availability. If the project ends, we'll give notice
          in the
          <Link href="/changelog">{" "}changelog</Link>.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        To the maximum extent allowed by law, the operator is not liable
        for any indirect, incidental, or consequential damages from your
        use of TideNow. The total cap on liability is the amount you
        paid us — which is zero.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using the site at any time. We can stop operating it
        at any time. We can refuse to serve users who abuse the API or
        violate acceptable use (above) without notice. There are no
        accounts to suspend, but we can block at the IP / network level
        as needed for abuse prevention.
      </p>

      <h2>Changes</h2>
      <p>
        If we change these terms, the "Last updated" date below changes.
        Material changes are also noted in the
        <Link href="/changelog">{" "}changelog</Link>. Continuing to use
        the site after a change means you accept the new terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the People's Republic of
        China. Any disputes will be heard in courts of competent
        jurisdiction there.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:alex.chu0206@gmail.com">alex.chu0206@gmail.com</a>
        {" "}— for any of this.
      </p>
    </article>
  )
}

function TermsZh() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>服务条款</h1>
      <p>
        TideNow 是个人维护的免费开源副业项目。使用本站即视为接受这份**简短的**条款。如有不清楚:
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>。
      </p>

      <h2>你能从本站得到的</h2>
      <p>
        一个只读的聚合页,展示 60+ 发布方的实时热议;以及一套**自带 API key**的 AI 摘要 / 写作工具。**按现状提供**,无任何担保、无 SLA、无服务合同。
      </p>

      <h2>代码 MIT,内容不是</h2>
      <ul>
        <li>TideNow 的应用代码遵循 MIT 协议开源。仓库:
          <a href="https://github.com/Alex92908/tidenow-web" target="_blank" rel="noopener noreferrer">
            {" "}github.com/Alex92908/tidenow-web
          </a>。
        </li>
        <li><strong>源卡片中显示的标题、缩略图、链接归原发布方所有</strong>(Hacker News、Reddit、BBC、路透、微博等)。TideNow 仅做聚合与跳转,**不主张所有权,也不以己方名义重发**。</li>
        <li><Link href="/zh/posts">/posts</Link> 的编辑文章由 TideNow 团队撰写,版权归各自作者。带署名的合理引用可,**全文转载需先取得授权**。</li>
      </ul>

      <h2>可接受的使用方式</h2>
      <p>你同意不:</p>
      <ul>
        <li>以明显属于自动化滥用的速率抓取本站。**合理使用** <code>/api/sources/&#123;id&#125;</code> 这个公开 JSON 接口完全没问题(我们特意开了 CORS);但影响他人正常访问的激进抓取不行。</li>
        <li>在任何输入框(Compose 草稿、AI prompt)提交违反法律、诽谤他人或含恶意载荷的内容。</li>
        <li>滥用 BYOK 工具违反上游 AI 服务商的 ToS——你与 OpenAI / Anthropic / DeepSeek / Google 的合同仍然有效,我们不能替你免责。</li>
        <li>试图绕过不存在的鉴权。(本站没有账号,什么都没有可绕的。)</li>
      </ul>

      <h2>"按现状"是什么意思</h2>
      <p>
        TideNow **按现状提供,不附任何形式担保**。我们不保证:
      </p>
      <ul>
        <li>持续可用。Vercel 会偶尔挂。上游 feed 会偶尔失效,直到我们修好抓取器。</li>
        <li>任何聚合内容的准确性。原发布方对自己写的内容负责,本站只是窗口。</li>
        <li>AI 生成内容的正确性。**可能错、可能有偏见、可能幻觉**。发布前必须人工核实。</li>
        <li>永久可用。若本项目终止,会在
          <Link href="/zh/changelog">{" "}更新日志</Link>提前公告。</li>
      </ul>

      <h2>责任限制</h2>
      <p>
        在法律允许的最大范围内,运营方对因使用 TideNow 造成的任何间接、附带或后果性损失**不承担责任**。责任上限 = 你向本站支付的金额,即**零**。
      </p>

      <h2>终止</h2>
      <p>
        你可以随时停止使用本站。我们可以随时停止运营本站。对滥用 API 或违反上述"可接受使用"的访问者,我们可不经通知拒绝服务。**本站没有账号可封停**,但可按需在 IP / 网段层面屏蔽以防滥用。
      </p>

      <h2>变更</h2>
      <p>
        本条款若有变更,页底"上次更新"日期同步更新。重大变更会同时记入
        <Link href="/zh/changelog">{" "}更新日志</Link>。变更后继续使用本站即视为接受新条款。
      </p>

      <h2>适用法律</h2>
      <p>
        本条款适用中华人民共和国法律。争议由有管辖权的中国法院审理。
      </p>

      <h2>联系</h2>
      <p>
        <a href="mailto:alex.chu0206@gmail.com">alex.chu0206@gmail.com</a> —— 所有事宜皆可。
      </p>
    </article>
  )
}
