import { NextRequest, NextResponse } from "next/server"
import type { AIProvider } from "@/lib/ai-settings"
import { getForesight, foresightContextBlock } from "@/lib/foresight-client"
import { extractArticles } from "@/lib/extract-article"

// Long-form companion to /api/summary. Same BYOK pattern (the key is sent
// per-request from localStorage, never stored server-side), but with a
// much larger max_tokens budget for full articles and no result cache —
// articles are user-specific, caching them would leak across visitors.
//
// We intentionally do NOT echo the user's key into any log or response.

const MAX_TOKENS_BY_STYLE: Record<string, number> = {
  // ~1.5 zh chars per token, ~1.3 en words per token. Budgets target the
  // upper bound of the labeled word range to give the model headroom.
  feature: 5000,   // 1800–3000字 zh / 1500–2200 words en — long-form
  deep: 2200,      // 800–1200字 zh / 600–900 words en
  humanity: 2600,  // 1000–1500字 — 人性洞察需要展开心理与动机
  erudite: 2800,   // 1200–1800字 — 学识深度需空间旁征博引
  quick: 1100,     // 400–600字 / ~350 words
  list: 1600,
  personal: 1800,
  custom: 2200,
}

async function callAI(
  provider: AIProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  switch (provider) {
    case "anthropic": {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "anthropic error")
      return d.content[0].text.trim()
    }
    case "openai": {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "openai error")
      return d.choices[0].message.content.trim()
    }
    case "deepseek": {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "deepseek error")
      return d.choices[0].message.content.trim()
    }
    case "zhipu": {
      const res = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "glm-4-flash",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "zhipu error")
      return d.choices[0].message.content.trim()
    }
    case "gemini": {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        }
      )
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message ?? "gemini error")
      return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""
    }
    default:
      throw new Error("unsupported provider")
  }
}

// Long requests can take 20s+; bump from the 10s default so Vercel
// doesn't kill us mid-stream on slow providers.
export const maxDuration = 60

interface ComposeRequest {
  provider: AIProvider
  apiKey: string
  locale: "en" | "zh"
  style: "feature" | "deep" | "quick" | "list" | "personal" | "custom"
  customPrompt?: string
  /** When true, run the lead material through the ForeSight prediction
   *  engine and feed its calibrated analysis to the writer so the
   *  article can ground a forward-looking section. */
  foresight?: boolean
  materials: {
    sourceName: string
    title: string
    url: string
    extra?: string
    /** Optional thumbnail / cover. When present, the AI is told to embed
     *  it inline via markdown so the rendered article carries real
     *  visuals from the source. */
    image?: string
  }[]
}

const STYLE_INSTRUCTIONS_ZH: Record<string, string> = {
  feature:
    `写一篇专题深度报道。目标长度 1800-3000 字，但宁可写少也不要编造内容凑字数。

**写作流程（不是章节标题）**：
1. 用一个具体细节、一个反差或一个问题开篇（避免「在...领域」「随着...」这种万能开头）
2. 把素材里的事实写出来 —— 谁、什么时间、做了什么，引用素材里有的数字
3. 至少给出 2 个互相不同的视角去分析
4. 加一段反方观点 —— 承认论点的局限或不确定性
5. 谈趋势，但只说素材支持的趋势
6. 结尾给一句有信息量的具体观察

**绝对禁止**：
- 拒绝写「导语钩子」「现象切片」「多角度分析」这种结构词作为 ## 二级标题，标题必须是内容相关的具体短语
- 拒绝编造素材里没有的具体日期、数字、公司动作、人名引述
- 拒绝「据某机构数据」「业内人士透露」「相关报告显示」这类填充式信源
- 拒绝「让我们拭目以待」「未来可期」「值得期待」「总而言之」「综上所述」这类套话
- 拒绝「随着...的发展」「在...的背景下」这类万能开头
- 充分利用每条素材的「正文节选」——把里面的具体事实、数字、引述都用上，不要只看标题
- 只有当所有素材的正文都很单薄时才写短；正文充足时应写满 1800-3000 字

**Markdown 要求**：
- 一级标题 # 一个，二级标题 ## 至少 3 个（内容相关，不是结构词）
- 如果素材带了 \`image:\` URL，在对应段落附近用 \`![标题](url)\` 嵌入图片
- 不要列表化所有内容，长文需要段落叙述

- 全文使用简体中文`,
  deep: "用 800-1200 字写一篇有观点的深度评论。结构上：开头钩子吸引读者 → 现象描述 → 原因分析 → 趋势预判。语气稳重克制，避免营销腔。如果素材之间能形成对比或互证，请挑明。",
  humanity: `用 1000-1500 字，从"人性"的角度剖析这些热点。不是复述发生了什么，而是追问：
- 事件里的人在图什么？（欲望、恐惧、面子、归属、损失厌恶…）
- 群体为什么这样反应？（从众、身份认同、道德义愤、幸灾乐祸的心理机制）
- 表象之下暴露了哪种恒久的人性弱点或规律？
要求：引用具体的心理学概念（如损失厌恶、旁观者效应、认知失调）但要用人话解释，不堆术语；有洞察、有共情，避免居高临下的说教；结尾给一句让人回味的关于人性的判断。全文简体中文。`,
  erudite: `用 1200-1800 字写一篇有学识密度的文章。把这些热点放进更大的知识坐标系里：
- 旁征博引：调动历史、哲学、经济学、社会学、科技史等跨学科视角，找到恰当的类比或先例
- 引用要具体（哪位思想家、哪段历史、哪个理论），但只引你确有把握的，绝不编造出处或杜撰名言
- 让读者读完有"原来还能这样看"的智识愉悦，而不是被术语砸晕
- 论证扎实，不炫技；博引是为了照亮当下，不是掉书袋
结尾落回现实，给一个有厚度的判断。全文简体中文。`,
  quick: "用 400-600 字写一篇 2 分钟速读总结。用 3-5 个小标题分段，每段不超过 100 字。让读者快速掌握今天发生了什么。",
  list: "用列表体写一篇文章：「Top N + 一句话点评」的格式。每条点评不超过 50 字。可适当编号或加 emoji 区分。",
  personal: "以第一人称写一篇 600-900 字的个人观察。带入自己的看法、经验或情绪，避免冷冰冰的事实罗列。语气像在朋友圈或即刻发动态。",
  custom: "",
}
const STYLE_INSTRUCTIONS_EN: Record<string, string> = {
  feature:
    `Write a feature article. Target 1800-3000 words, but write shorter rather than fabricate.

**Flow (these are NOT section headings)**:
1. Open with a concrete detail, contrast, or question — never "In the era of..." / "As X grows..."
2. Report the facts that ARE in the materials — who, when, what, the numbers that appear
3. Give at least 2 distinct analytical viewpoints
4. Add a counterpoint that acknowledges limits or uncertainty
5. Forecast only what the materials support
6. Close with one specific, substantive observation

**Hard prohibitions**:
- Never use scaffolding words ("Lead hook", "Reported slice", "Counterpoint") as ## subheadings — subheadings must be content-specific phrases
- Never fabricate dates, numbers, company actions, named quotes that aren't in the materials
- Never plug filler attribution like "according to industry sources" / "reportedly" / "analysts say"
- Never end with "Time will tell" / "Stay tuned" / "In conclusion" / "Only time will show"
- Never open with "In the era of..." / "As [X] continues to grow..."
- Fully mine each material's "body excerpt" — use the specific facts, numbers, and quotes in it, not just the headline.
- Only write short when every material's body is genuinely thin; with rich bodies, fill the 1800-3000 word range.

**Markdown**:
- One # H1, at least 3 ## subheadings (content-specific, not flow labels)
- If a material has \`image: <url>\`, embed it inline near the relevant paragraph using \`![title](url)\`
- Use prose, not bullets-for-everything

- English only`,
  deep: "Write an 800-1200 word opinion piece. Structure: a hook lead → describe the phenomenon → analyze causes → forecast trends. Measured tone, no marketing fluff. If the source items contrast or reinforce each other, call it out.",
  humanity: `Write 1000-1500 words dissecting these trends through the lens of human nature. Don't recount what happened — ask WHY people act this way:
- What are the people in the story really after? (desire, fear, face, belonging, loss-aversion…)
- Why does the crowd react like this? (conformity, identity, moral outrage, schadenfreude)
- What enduring human weakness or pattern does the surface expose?
Cite specific psychology concepts (loss aversion, bystander effect, cognitive dissonance) but explain them plainly, no jargon-dumping. Insightful and empathetic, never preachy. End on a resonant judgment about human nature. English only.`,
  erudite: `Write a 1200-1800 word erudite piece that places these trends in a larger intellectual coordinate system:
- Draw on history, philosophy, economics, sociology, the history of science — find apt analogies and precedents across disciplines.
- Be specific with references (which thinker, which historical episode, which theory), but cite ONLY what you're genuinely sure of — never fabricate sources or invent quotes.
- Give the reader the intellectual pleasure of "I never saw it that way", without burying them in terminology.
- Rigorous, not show-offy — erudition should illuminate the present, not pad the page.
End back in the present with a judgment that has weight. English only.`,
  quick: "Write a 400-600 word 2-minute read. Use 3-5 sub-headings, each section under 100 words. Reader should grasp what happened today fast.",
  list: "Write in list format: 'Top N + one-line take' per item. Each take under 50 words. Use numbers or emoji to differentiate.",
  personal: "Write 600-900 words in first person. Include personal view, experience, or feeling. Avoid dry fact-stacking. Casual blog/journal tone.",
  custom: "",
}

export async function POST(req: NextRequest) {
  let body: ComposeRequest
  try {
    body = (await req.json()) as ComposeRequest
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const { provider, apiKey, locale, style, customPrompt, materials, foresight } = body
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "missing provider/apiKey" }, { status: 503 })
  }
  if (!materials?.length) {
    return NextResponse.json({ error: "no materials" }, { status: 400 })
  }

  // Kick off article-body extraction immediately so it overlaps the
  // (much slower) ForeSight call below instead of running after it.
  // Extraction is best-effort: SPA / JS-rendered sources (Weibo, Douyin)
  // come back empty and we fall back to title-only. Cap at 3 fetches to
  // keep latency bounded.
  // Extract bodies for EVERY material the user picked — they chose them,
  // so they all feed the writer. Capped at 5 by the picker (MAX_SELECTED)
  // and extraction runs in parallel, so the latency is bounded by the
  // single slowest fetch, not the sum.
  const articlesPromise = extractArticles(materials.map((m) => m.url), materials.length)

  // Optional ForeSight pass. We predict on the lead material only — running
  // the engine on every item would multiply latency and most articles
  // pivot on one main story anyway. Failure is silent: a missing prediction
  // just means the article skips its forward-looking section.
  let foresightBlock = ""
  if (foresight) {
    const lead = materials[0]
    const seed = lead.extra ? `${lead.title}（${lead.extra}）` : lead.title
    // ForeSight reuses the user's own BYOK key — no separate provider key.
    const fs = await getForesight(seed, { provider, apiKey })
    if (fs && fs.markdown) {
      foresightBlock = foresightContextBlock(fs, locale === "zh" ? "zh" : "en")
    }
  }

  // By now extraction has had the ForeSight window to finish.
  const articles = await articlesPromise

  const isZh = locale === "zh"
  const styleInstr =
    style === "custom"
      ? (customPrompt ?? "").trim() || (isZh ? "请根据素材自由发挥写一篇文章。" : "Write an article freely based on the materials.")
      : isZh
        ? STYLE_INSTRUCTIONS_ZH[style]
        : STYLE_INSTRUCTIONS_EN[style]

  const systemPrompt = isZh
    ? `你是一个公众号/头条创作者。${styleInstr}\n\n硬性要求：\n- 全文必须使用简体中文，无论素材是什么语言\n- 输出 Markdown 格式：# 一级标题在最前，## 二级标题分段\n- 不要复述素材标题；用自己的话总结和延展\n- 不要在文中说"根据某某热榜"，要像编辑写文章，不要像 AI 在汇报\n- 结尾不要套话（"总之"、"让我们拭目以待"），用一句有信息量的话收尾`
    : `You are a writer producing newsletter / blog content. ${styleInstr}\n\nStrict rules:\n- Reply in English only, regardless of the source language\n- Output Markdown: # H1 at top, ## H2 for sections\n- Don't restate source headlines verbatim; synthesize and extend in your own words\n- Don't say "according to trending lists"; write like an editor, not an AI reporting\n- No filler closing ("In conclusion", "Time will tell") — end with one substantive sentence`

  const materialBlock = materials
    .map((m, i) => {
      const lines = [`${i + 1}. [${m.sourceName}] ${m.title}`]
      if (m.extra) lines.push(`   ${m.extra}`)
      lines.push(`   url: ${m.url}`)
      if (m.image) lines.push(`   image: ${m.image}`)
      const art = articles[i]
      if (art?.summary) lines.push(`   ${isZh ? "摘要" : "summary"}: ${art.summary}`)
      if (art?.text) {
        lines.push(`   ${isZh ? "正文节选" : "body excerpt"}:`)
        lines.push(art.text.split("\n").map((l) => `     ${l}`).join("\n"))
      }
      return lines.join("\n")
    })
    .join("\n\n")

  // When ForeSight ran, append its analysis after the materials and tell
  // the writer how to use it: as grounding for ONE forward-looking
  // section, not as a fact to parrot. The engine's probability is
  // calibrated, so the article can cite it, but it must stay clearly
  // framed as a prediction, not reported fact.
  const foresightInstr = foresightBlock
    ? isZh
      ? `\n\n${foresightBlock}\n\n请在文章中加入一段前瞻性分析，用到上面的概率判断。严格遵守：
- 上面的分析可能是中文，但你的输出语言以全文为准——若全文是中文就保持中文。
- 绝对不要出现"ForeSight""预测引擎""舆情仿真"这类工具/方法名词，把判断自然融进行文。
- 上面分析里若出现任何人名、网友发言、具体引述，那都是仿真生成的虚拟角色，不是真人——绝对不能当作真实人物写进文章，不能引用他们的名字或原话。只能用作"整体倾向/概率"层面的判断。
- 明确这是一种"预判/可能性"，不是既成事实，用"或""可能""倾向于"这类措辞。`
      : `\n\n${foresightBlock}\n\nAdd one forward-looking section using the probability above. Follow strictly:
- The analysis above may be in Chinese, but your output language follows the article — if the article is English, write this section in English too. Never leave foreign-language fragments in.
- Never name the tool or method ("ForeSight", "prediction engine", "opinion simulation"). Weave the judgment naturally into the prose.
- Any person names, user quotes, or specific statements in the analysis above are SIMULATED virtual agents, not real people — never present them as real individuals, never cite their names or words. Use them only as aggregate sentiment / probability signal.
- Frame it as a forecast / likelihood, not established fact — use hedged language ("may", "is likely to", "leans toward").`
    : ""

  const userPrompt = isZh
    ? `以下是 ${materials.length} 条今日热点素材，请基于它们写文章：\n\n${materialBlock}${foresightInstr}\n\n现在开始写：`
    : `Here are ${materials.length} trending items today. Use them to write the article:\n\n${materialBlock}${foresightInstr}\n\nBegin:`

  const maxTokens = MAX_TOKENS_BY_STYLE[style] ?? 2000

  try {
    const markdown = await callAI(provider, apiKey, systemPrompt, userPrompt, maxTokens)
    return NextResponse.json({ markdown })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
