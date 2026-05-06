import Database from "better-sqlite3"
import path from "path"
import type { CachedSource, NewsItem } from "./types"

// Vercel's /var/task (cwd) is read-only; use /tmp when running on Vercel
const DB_PATH = process.env.VERCEL ? "/tmp/tidenow.db" : path.join(process.cwd(), "tidenow.db")

let db: Database.Database | null = null

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        id TEXT PRIMARY KEY,
        items TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS summaries (
        title_hash TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `)
  }
  return db
}

export function getCached(id: string, ttl: number): NewsItem[] | null {
  const row = getDb()
    .prepare("SELECT items, updated_at FROM cache WHERE id = ?")
    .get(id) as { items: string; updated_at: number } | undefined

  if (!row) return null
  if (Date.now() - row.updated_at > ttl) return null
  return JSON.parse(row.items)
}

export function setCached(id: string, items: NewsItem[]) {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO cache (id, items, updated_at) VALUES (?, ?, ?)"
    )
    .run(id, JSON.stringify(items), Date.now())
}

export function getStale(id: string): CachedSource | null {
  const row = getDb()
    .prepare("SELECT items, updated_at FROM cache WHERE id = ?")
    .get(id) as { items: string; updated_at: number } | undefined

  if (!row) return null
  return { id, items: JSON.parse(row.items), updatedAt: row.updated_at }
}

export function getCachedSummary(titleHash: string): string | null {
  const row = getDb()
    .prepare("SELECT summary FROM summaries WHERE title_hash = ?")
    .get(titleHash) as { summary: string } | undefined
  return row?.summary ?? null
}

export function setCachedSummary(titleHash: string, summary: string) {
  getDb()
    .prepare("INSERT OR REPLACE INTO summaries (title_hash, summary, created_at) VALUES (?, ?, ?)")
    .run(titleHash, summary, Date.now())
}
