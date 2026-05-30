import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.tide-now.com"

// Explicit allow for the major AI / search crawlers. Default-allow already
// covers them, but listing each makes the intent unambiguous (and surfaces
// in robots.txt audit tools that look for these specific user-agents).
const AI_BOTS = [
  "GPTBot",            // OpenAI — ChatGPT browsing + training
  "ChatGPT-User",      // OpenAI — direct ChatGPT browsing
  "OAI-SearchBot",     // OpenAI Search
  "ClaudeBot",         // Anthropic
  "anthropic-ai",      // Anthropic legacy UA
  "Claude-Web",        // Anthropic web fetch
  "PerplexityBot",     // Perplexity
  "Perplexity-User",   // Perplexity direct
  "Google-Extended",   // Google Bard / Gemini training
  "CCBot",             // Common Crawl (feeds many open-weight models)
  "Bytespider",        // ByteDance / Doubao
  "Amazonbot",         // Amazon Alexa / Q
  "Applebot-Extended", // Apple Intelligence
  "Meta-ExternalAgent",// Meta AI
  "DuckAssistBot",     // DuckDuckGo AI
  "Bingbot",           // Bing search — also feeds Copilot
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
      },
      // Explicit allow rows for AI crawlers so audit tools / curious humans
      // can confirm we welcome them. /api/ is still disallowed (the public
      // JSON is for browsers — bots should crawl the rendered HTML pages).
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: "/api/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
