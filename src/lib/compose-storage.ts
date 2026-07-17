// Local-only persistence for the /compose tool. Drafts never leave the
// browser — no server, no account, no "submit". The escape hatch is the
// import / export buttons: a single JSON blob you can move between
// devices yourself.

import type { NewsItem } from "@/lib/types"

const DRAFTS_KEY = "tidenow-compose-drafts"
const MAX_DRAFTS = 20

export interface DraftMaterial {
  /** Stable across reloads: `${sourceId}:${item.id}`. Lets us de-dupe and
   *  jump back to the source even after the upstream cache rotates. */
  ref: string
  sourceId: string
  sourceName: string
  title: string
  url: string
  extra?: string
  /** Source's thumbnail / cover image, if available. Passed to the AI
   *  so it can embed visuals in long-form output. */
  image?: string
}

export type DraftStyle = "feature" | "deep" | "humanity" | "erudite" | "quick" | "list" | "personal" | "custom"

export interface Draft {
  id: string
  createdAt: number
  updatedAt: number
  /** First non-empty line, derived from the markdown — used as the sidebar
   *  label so the user doesn't have to title their drafts. */
  preview: string
  style: DraftStyle
  customPrompt?: string
  materials: DraftMaterial[]
  markdown: string
  /** AI output language for this draft. Independent of the page locale —
   *  a Chinese-UI user can author English articles and vice versa. */
  locale: "en" | "zh"
}

export function newDraftId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function listDrafts(): Draft[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(DRAFTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as Draft[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveDraft(draft: Draft): Draft[] {
  const all = listDrafts()
  const idx = all.findIndex((d) => d.id === draft.id)
  const next: Draft = { ...draft, updatedAt: Date.now(), preview: derivePreview(draft.markdown) }
  if (idx === -1) all.unshift(next)
  else all[idx] = next
  // Newest-first, cap to MAX_DRAFTS so the bucket never bloats. We sort
  // before truncating so a stale draft can't survive at the bottom by
  // gaming its createdAt.
  all.sort((a, b) => b.updatedAt - a.updatedAt)
  const trimmed = all.slice(0, MAX_DRAFTS)
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(trimmed))
  return trimmed
}

export function deleteDraft(id: string): Draft[] {
  const all = listDrafts().filter((d) => d.id !== id)
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(all))
  return all
}

export function materialFromItem(
  sourceId: string,
  sourceName: string,
  item: NewsItem
): DraftMaterial {
  return {
    ref: `${sourceId}:${item.id}`,
    sourceId,
    sourceName,
    title: item.title,
    url: item.url,
    extra: item.extra,
    image: item.image,
  }
}

function derivePreview(md: string): string {
  const firstLine = md
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0)
  return (firstLine ?? "").slice(0, 80)
}

// JSON import / export — the "sync between devices" escape hatch.
export function exportDrafts(): string {
  return JSON.stringify({ version: 1, drafts: listDrafts() }, null, 2)
}

export function importDrafts(json: string, mode: "merge" | "replace" = "merge"): Draft[] {
  const parsed = JSON.parse(json) as { version?: number; drafts?: Draft[] }
  const incoming = Array.isArray(parsed.drafts) ? parsed.drafts : []
  const merged = mode === "replace" ? incoming : [...incoming, ...listDrafts()]
  // De-dupe by id; incoming wins on conflict.
  const seen = new Set<string>()
  const deduped = merged.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
  deduped.sort((a, b) => b.updatedAt - a.updatedAt)
  const trimmed = deduped.slice(0, MAX_DRAFTS)
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(trimmed))
  return trimmed
}
