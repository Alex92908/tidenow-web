"use client"

import type { NewsItem } from "./types"

export interface TrendingTopic {
  keyword: string
  displayTitle: string
  score: number
  mentions: Array<{
    sourceId: string
    item: NewsItem
    rank: number
  }>
}

const EN_STOP_WORDS = new Set([
  "the","a","an","is","in","on","at","to","for","of","and","or","but","with",
  "by","from","as","that","this","it","he","she","they","we","you","i","was",
  "are","has","have","had","be","been","being","do","does","did","will","would",
  "could","should","may","might","must","can","about","after","before","into",
  "through","during","up","down","out","over","under","again","then","once",
  "says","said","say","new","more","also","just","than","how","what","when",
  "where","who","which","if","not","its","his","her","their","our","my","your",
  "after","report","reuters","cnn","bbc","amid","following","related","watch",
  "latest","breaking","update","vs","via","per","re","s","t","d","ll","ve",
  "million","billion","year","years","day","days","week","month","time","first",
  "two","three","four","five","one","no","so","than","too","very","here","there",
])

function isChinese(text: string) {
  return /[一-鿿]/.test(text)
}

function extractKeywords(title: string): string[] {
  if (isChinese(title)) {
    // Extract 2-char sequences for Chinese
    const clean = title.replace(/[^一-鿿]/g, "")
    const bigrams: string[] = []
    for (let i = 0; i < clean.length - 1; i++) {
      bigrams.push(clean.slice(i, i + 2))
    }
    return bigrams
  }
  // English: split and filter stopwords
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !EN_STOP_WORDS.has(w))
}

export function aggregateTrending(
  sourceData: Record<string, { items: NewsItem[] }>,
  minSources = 2,
  topN = 8
): TrendingTopic[] {
  // keyword → list of mentions
  const kwMap = new Map<string, Array<{ sourceId: string; item: NewsItem; rank: number }>>()

  for (const [sourceId, { items }] of Object.entries(sourceData)) {
    items.slice(0, 20).forEach((item, idx) => {
      const keywords = extractKeywords(item.title)
      const seen = new Set<string>()
      for (const kw of keywords) {
        if (seen.has(kw)) continue
        seen.add(kw)
        if (!kwMap.has(kw)) kwMap.set(kw, [])
        kwMap.get(kw)!.push({ sourceId, item, rank: idx + 1 })
      }
    })
  }

  // Filter: must appear in 2+ different sources
  const topics: TrendingTopic[] = []
  for (const [keyword, mentions] of kwMap.entries()) {
    const sources = new Set(mentions.map((m) => m.sourceId))
    if (sources.size < minSources) continue

    // Score: each mention contributes (21 - rank), higher rank = more weight
    const score = mentions.reduce((acc, m) => acc + Math.max(21 - m.rank, 1), 0)

    // Best title = the mention with lowest rank number
    const best = mentions.reduce((a, b) => (a.rank < b.rank ? a : b))

    topics.push({ keyword, displayTitle: best.item.title, score, mentions })
  }

  // Deduplicate: if two keywords share the same top item, keep the higher-score one
  topics.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  const deduped: TrendingTopic[] = []
  for (const topic of topics) {
    const key = topic.mentions[0]?.item.url ?? topic.keyword
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(topic)
    if (deduped.length >= topN) break
  }

  return deduped
}
