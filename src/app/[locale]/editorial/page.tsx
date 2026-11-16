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
  const title =
    locale === "zh" ? "编辑标准 | TideNow" : "Editorial Standards | TideNow"
  const description =
    locale === "zh"
      ? "TideNow 如何选题、如何核实、如何使用 AI、如何更正错误。"
      : "How TideNow selects stories, verifies facts, uses AI, and corrects errors."
  const canonical =
    locale === "zh" ? `${SITE_URL}/zh/editorial` : `${SITE_URL}/editorial`
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}/editorial`,
        "zh-Hans": `${SITE_URL}/zh/editorial`,
        "x-default": `${SITE_URL}/editorial`,
      },
    },
    openGraph: { type: "article", url: canonical, title, description },
  }
}

export default async function EditorialPage({
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

      {lang === "zh" ? <EditorialZh /> : <EditorialEn />}
    </main>
  )
}

function EditorialEn() {
  return (
    <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>Editorial Standards</h1>

      <p>
        TideNow is two things: a real-time aggregator of public hot lists,
        and an editorial publication that writes original briefings from
        what those lists show. This page states how the editorial side
        works — what we write, how we verify it, how we use AI, and how we
        fix mistakes.
      </p>

      <h2>What we publish</h2>
      <p>
        Our original pieces live at <Link href="/posts">/posts</Link>. They
        fall into three kinds: <strong>trend briefings</strong> (what is
        rising across our sources, why it is rising, and how coverage
        differs), <strong>cross-source comparisons</strong> (how several
        outlets frame the same story, with our own synthesis), and{" "}
        <strong>explainers</strong> (durable background on a topic the news
        keeps returning to). The hot lists themselves are not articles —
        they are headlines and links to the original reporting, and they
        are labelled as such.
      </p>

      <h2>Sourcing and verification</h2>
      <p>
        Every briefing starts from the aggregated lists, but no claim in
        an article rests on a headline alone. Before publishing, the
        author checks the claim against the linked original reporting and,
        where it matters, against a primary document (a filing, a company
        statement, an official record). If two sources disagree, the
        article says so instead of picking the louder one. Rumour is
        labelled as rumour. We do not copy articles, and we do not present
        another outlet&apos;s reporting as our own — headlines link out to
        their source, and summaries are written in our own words.
      </p>

      <h2>How we choose sources</h2>
      <p>
        The 57 sources on the board are chosen for reach and reliability:
        wire services and established newsrooms (BBC, Reuters, AP, The
        Guardian), developer and tech communities (Hacker News, GitHub,
        Product Hunt), finance wires (Wall Street CN, CLS, Jin10), and the
        major Chinese hot lists (Weibo, Zhihu, Bilibili, 36kr). We exclude
        sources that are mostly clickbait, that do not link to original
        reporting, or that cannot be fetched reliably. The list is reviewed
        when a source goes stale or its quality drops — a source that stops
        updating is dropped, not kept for the count.
      </p>

      <h2>AI use</h2>
      <p>
        AI is a drafting and research assistant, not an author. A draft
        may be generated from the trending items, but a human editor
        fact-checks it against the original sources, adds judgement and
        context, and edits it into a consistent voice before anything is
        published. We do not mass-publish AI output, and we do not publish
        identical templated articles. The daily digest is produced the same
        way: AI drafts, human reviews, then it goes out.
      </p>

      <h2>Corrections</h2>
      <p>
        When we get something wrong, we fix it and say so. Corrections
        are noted at the top of the affected article with the date and
        what changed; the original error is not silently rewritten. To
        report an error, use the <Link href="/contact">contact page</Link>{" "}
        or open an issue on{" "}
        <a
          href="https://github.com/Alex92908/tidenow-web"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        . We aim to correct factual errors within one working day.
      </p>

      <h2>Who writes this</h2>
      <p>
        The editor is <strong>Alex</strong>, who built TideNow and writes
        the briefings. He is an independent developer, not a newsroom —
        which is why every factual claim links to the outlet that reported
        it, so you can check the work. TideNow is funded by its author;
        it takes no sponsored editorial, and no briefing is paid placement.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>No financial advice. Finance coverage describes what happened and what markets did; it is not a recommendation to buy or sell anything.</li>
        <li>No republishing of full articles, images, or video from other outlets.</li>
        <li>No paid placement presented as editorial. If that ever changes, it will be labelled.</li>
      </ul>
    </article>
  )
}

function EditorialZh() {
  return (
    <article className="prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-sky-500">
      <h1>编辑标准</h1>

      <p>
        TideNow 有两面：一面是实时聚合公开热榜，另一面是根据这些热榜写原创简报的编辑出版物。本页说明编辑这一面怎么做——写什么、怎么核实、怎么用
        AI、错了怎么改。
      </p>

      <h2>我们写什么</h2>
      <p>
        原创文章在 <Link href="/zh/posts">/posts</Link>。分三种：
        <strong>趋势简报</strong>（什么在涨、为什么涨、各家报道有什么不同）、
        <strong>跨源对比</strong>（几家媒体怎么讲同一个故事，加上我们自己的综合判断）、
        <strong>背景解析</strong>（新闻反复提到的主题，讲清楚来龙去脉）。热榜本身不是文章——只是标题加原文链接，会明确标出来。
      </p>

      <h2>信源与核实</h2>
      <p>
        每篇简报从聚合榜单出发，但文章里的任何说法都不会只靠一个标题。发表前，作者会对照原文报道核实，重要的会对照一手材料（财报、公司声明、官方记录）。两家信源说法不一致时，文章会写明分歧，而不是挑声音大的那家。传闻会标明是传闻。我们不复制文章，不把别家报道说成自己的——标题都链向原文，摘要用自己的话写。
      </p>

      <h2>怎么选源</h2>
      <p>
        板上的 57 个源按影响力和可靠性选：通讯社和老牌新闻机构（BBC、Reuters、AP、The
        Guardian）、开发者与科技社区（Hacker News、GitHub、Product
        Hunt）、财经快讯（华尔街见闻、财联社、金十），以及中文主流热榜（微博、知乎、Bilibili、36氪）。我们排除以标题党为主、不链向原文、或抓取不稳定的源。源的质量下降或长期不更新时会被下掉，不会为了凑数留着。
      </p>

      <h2>AI 的使用</h2>
      <p>
        AI 是起草和研究助手，不是作者。草稿可以由 AI
        根据热点生成，但发表前必须经过人工编辑对照原文核实、加入判断和背景、统一语言风格。我们不批量发表
        AI 产出，不发模板化的雷同文章。每日 digest 也是同样流程：AI 起草，人工审过才发出。
      </p>

      <h2>更正</h2>
      <p>
        写错了就改，并且明说。更正会标在文章顶部，写明日期和改了什么，不会悄悄改掉原文。发现错误请通过
        <Link href="/zh/contact">联系页</Link> 或在{" "}
        <a
          href="https://github.com/Alex92908/tidenow-web"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>{" "}
        提 issue。事实性错误我们争取一个工作日内更正。
      </p>

      <h2>谁在写</h2>
      <p>
        编辑是 <strong>Alex</strong>，TideNow 的作者和简报撰写人。他是独立开发者，不是一个新闻机构——所以每条事实都会链向报道它的媒体，方便读者自己核对。TideNow
        由作者自费运营，不接赞助软文，没有任何一篇简报是付费植入。
      </p>

      <h2>我们不做的事</h2>
      <ul>
        <li>不提供投资建议。财经内容只描述发生了什么、市场怎么反应，不建议买入或卖出任何东西。</li>
        <li>不转载别家全文、图片或视频。</li>
        <li>不把付费植入写成编辑内容。如果将来有，会明确标注。</li>
      </ul>
    </article>
  )
}
