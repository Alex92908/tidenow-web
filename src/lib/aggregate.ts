"use client"

import type { NewsItem } from "./types"

export interface TrendingTopic {
  keyword: string
  displayTitle: string
  /** Detected language of the cluster's best title. Lets the UI filter by
   *  the user's current locale so an English visitor doesn't get a wall of
   *  Chinese trending topics (and vice versa). */
  lang: "zh" | "en"
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

// Cheap English suffix stemmer — collapses inflected forms so "warns" /
// "warned" / "warning" all cluster as "warn". Not a real Porter stemmer
// but covers the inflections we actually see in news headlines.
function stem(w: string): string {
  if (w.length < 5) return w
  if (w.endsWith("ies")) return w.slice(0, -3) + "y"
  if (w.endsWith("ing")) return w.slice(0, -3)
  if (w.endsWith("ed")) return w.slice(0, -2)
  if (w.endsWith("es")) return w.slice(0, -2)
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) {
    return w.slice(0, -1)
  }
  return w
}

function extractKeywords(title: string): string[] {
  if (isChinese(title)) {
    // Chinese: 2-char bigrams. Loose on their own but combined with the
    // shared-keyword threshold (need MANY bigrams to overlap) they cluster
    // accurately without needing a proper tokenizer.
    const clean = title.replace(/[^一-鿿]/g, "")
    const bigrams: string[] = []
    for (let i = 0; i < clean.length - 1; i++) {
      bigrams.push(clean.slice(i, i + 2))
    }
    return bigrams
  }
  // English: words longer than 3 chars, minus stop words, stemmed.
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !EN_STOP_WORDS.has(w))
    .map(stem)
}

// Lightweight union-find for clustering items pairwise.
class UnionFind<K> {
  parent = new Map<K, K>()
  find(x: K): K {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      return x
    }
    const p = this.parent.get(x)!
    if (p === x) return x
    const root = this.find(p)
    this.parent.set(x, root)
    return root
  }
  union(a: K, b: K) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

interface ItemRecord {
  sourceId: string
  item: NewsItem
  rank: number
  keywords: Set<string>
  key: string
}

export function aggregateTrending(
  sourceData: Record<string, { items: NewsItem[] }>,
  minSources = 2,
  topN = 8
): TrendingTopic[] {
  // 1. Flatten every source's top items + extract keyword set per item.
  const records: ItemRecord[] = []
  for (const [sourceId, { items }] of Object.entries(sourceData)) {
    items.slice(0, 20).forEach((item, idx) => {
      const kws = extractKeywords(item.title)
      if (kws.length === 0) return
      records.push({
        sourceId,
        item,
        rank: idx + 1,
        keywords: new Set(kws),
        key: `${sourceId}|${idx}`,
      })
    })
  }

  // 2. Cluster items across sources by keyword-set overlap.
  //    The old algorithm grouped by every SINGLE matching keyword, which
  //    over-clustered (e.g. one shared bigram "阿里" was enough to put an
  //    unrelated Alibaba story in the same topic). Now we require a real
  //    body of shared keywords — different thresholds for Chinese (many
  //    bigrams per title) and English (fewer keywords per title).
  const uf = new UnionFind<string>()
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]
      const b = records[j]
      // Don't fuse items from the same source — those are different stories
      // by that source's editor, not a "cross-source" trend.
      if (a.sourceId === b.sourceId) continue
      const aIsZh = isChinese(a.item.title)
      const bIsZh = isChinese(b.item.title)
      // If languages differ, skip — likely unrelated.
      if (aIsZh !== bIsZh) continue
      let shared = 0
      // Iterate the smaller set for speed.
      const [small, big] = a.keywords.size <= b.keywords.size ? [a.keywords, b.keywords] : [b.keywords, a.keywords]
      for (const k of small) if (big.has(k)) shared++
      // Threshold: Chinese needs ≥4 shared bigrams (titles typically have
      // 10-20 bigrams), English needs ≥2 shared content words. English news
      // outlets reword the same story heavily — "Trump warns..." vs "Iran
      // responds to Trump deadline" only share two keywords (trump, iran),
      // so a strict ≥3 threshold suppresses almost all English clusters.
      const threshold = aIsZh ? 4 : 2
      if (shared >= threshold) uf.union(a.key, b.key)
    }
  }

  // 3. Group records by their cluster root.
  const clusters = new Map<string, ItemRecord[]>()
  for (const r of records) {
    const root = uf.find(r.key)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(r)
  }

  // 4. Emit clusters that span ≥ minSources distinct sources.
  const topics: TrendingTopic[] = []
  for (const cluster of clusters.values()) {
    const sources = new Set(cluster.map((r) => r.sourceId))
    if (sources.size < minSources) continue

    const best = cluster.reduce((a, b) => (a.rank < b.rank ? a : b))
    const score = cluster.reduce((acc, r) => acc + Math.max(21 - r.rank, 1), 0)

    topics.push({
      keyword: best.item.title.slice(0, 12),
      displayTitle: best.item.title,
      lang: isChinese(best.item.title) ? "zh" : "en",
      score,
      mentions: cluster.map(({ sourceId, item, rank }) => ({ sourceId, item, rank })),
    })
  }

  topics.sort((a, b) => b.score - a.score)
  // Return ~3x topN so callers can filter by locale and still have enough
  // entries to show topN of the user's language.
  return topics.slice(0, topN * 3)
}
