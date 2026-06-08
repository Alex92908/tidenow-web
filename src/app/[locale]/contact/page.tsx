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
  const title = locale === "zh" ? "联系 | TideNow" : "Contact | TideNow"
  const description =
    locale === "zh"
      ? "怎么联系到我们——以及大致几小时内能回信。"
      : "How to reach us, and roughly how fast you'll hear back."
  const canonical = locale === "zh" ? `${SITE_URL}/zh/contact` : `${SITE_URL}/contact`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/contact`,
        "zh-Hans": `${SITE_URL}/zh/contact`,
        "x-default": `${SITE_URL}/contact`,
      },
    },
    openGraph: { type: "article", url: canonical, title, description },
  }
}

export default async function ContactPage({
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

      {lang === "zh" ? <ContactZh /> : <ContactEn />}
    </main>
  )
}

function ContactEn() {
  return (
    <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>Contact</h1>

      <p>
        TideNow is a one-person side project. There's no support team —
        just me. The fastest way to reach me depends on what you need.
      </p>

      <h2>Email</h2>
      <p>
        <a href="mailto:alex.chu0206@gmail.com">alex.chu0206@gmail.com</a>
      </p>
      <p>
        Best for: business inquiries, privacy / data requests, press,
        anything sensitive. Usually I reply within 24–48 hours.
      </p>

      <h2>GitHub Issues</h2>
      <p>
        <a href="https://github.com/Alex92908/tidenow-web/issues" target="_blank" rel="noopener noreferrer">
          github.com/Alex92908/tidenow-web/issues
        </a>
      </p>
      <p>
        Best for: bug reports, feature requests, broken sources, scraper
        rot, anything technical. Public by default — easier for me to
        triage and for others to find the same issue.
      </p>

      <h2>Discord community</h2>
      <p>
        <a href="https://discord.gg/chjPuC963T" target="_blank" rel="noopener noreferrer">
          discord.gg/chjPuC963T
        </a>
      </p>
      <p>
        Best for: chatting about the product, swapping aggregator tips,
        early previews. Smaller and quieter than email — feel free to
        say hi.
      </p>

      <h2>What I probably won't reply to</h2>
      <ul>
        <li>SEO / backlink outreach (please don't)</li>
        <li>Generic "let's partner" pitches without a specific idea</li>
        <li>Crypto / NFT integrations of any kind</li>
        <li>Requests to remove an aggregated source — please contact the
          original publisher; we just link to them</li>
      </ul>

      <h2>If you found a security issue</h2>
      <p>
        Please email
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>
        {" "}with "SECURITY" in the subject line and details. Please
        don't open a public GitHub issue for unpatched vulnerabilities.
      </p>
    </article>
  )
}

function ContactZh() {
  return (
    <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>联系我们</h1>

      <p>
        TideNow 是一个独立开发者的副业项目。**没有客服团队**——就我一个人。最快的联系方式取决于你想说的事是什么。
      </p>

      <h2>邮件</h2>
      <p>
        <a href="mailto:alex.chu0206@gmail.com">alex.chu0206@gmail.com</a>
      </p>
      <p>
        适合:商务合作、隐私 / 数据请求、媒体采访、任何敏感事项。一般 24-48 小时内回复。
      </p>

      <h2>GitHub Issues</h2>
      <p>
        <a href="https://github.com/Alex92908/tidenow-web/issues" target="_blank" rel="noopener noreferrer">
          github.com/Alex92908/tidenow-web/issues
        </a>
      </p>
      <p>
        适合:bug 反馈、新功能请求、某个源挂了、抓取规则失效,任何技术类问题。默认公开——方便我归类,也方便其他人查到同样的问题。
      </p>

      <h2>Discord 社群</h2>
      <p>
        <a href="https://discord.gg/chjPuC963T" target="_blank" rel="noopener noreferrer">
          discord.gg/chjPuC963T
        </a>
      </p>
      <p>
        适合:聊聊产品、互通聚合站经验、看早期预览。比邮件更轻、更日常,欢迎进来打招呼。
      </p>

      <h2>我大概率不会回复的</h2>
      <ul>
        <li>SEO / 反向链接合作(请别)</li>
        <li>没具体方向的「想合作」泛邀约</li>
        <li>任何 Crypto / NFT 集成</li>
        <li>要求下架某个聚合源——请联系原发布方,我们只是做了链接</li>
      </ul>

      <h2>发现安全问题?</h2>
      <p>
        请邮件
        <a href="mailto:alex.chu0206@gmail.com">{" "}alex.chu0206@gmail.com</a>,主题写「SECURITY」,附详情。**请不要在 GitHub 公开 issue 报未修复的漏洞**。
      </p>
    </article>
  )
}
