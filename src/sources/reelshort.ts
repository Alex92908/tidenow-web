import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "reelshort",
  icon: "🎬",
  accentColor: "bg-gradient-to-r from-red-600 to-rose-500",
  interval: 60 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "global",
}

// ReelShort TOP shelf — the overseas short-drama chart. The shelf page is a
// Next.js page whose __NEXT_DATA__ embeds the full ranked list (200 titles):
// https://www.reelshort.com/shelf/top-short-movies-dramas-51004673
// Each entry: { book_id, book_title, book_pic, read_count, collect_count }.
// Detail pages live at /movie/{slug}-{book_id}.
type ShelfEntry = {
  book_id?: string
  book_title?: string
  book_pic?: string
  read_count?: number
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://www.reelshort.com/shelf/top-short-movies-dramas-51004673",
    { headers: { Accept: "text/html" } }
  )
  if (!res.ok) return []
  const html = await res.text()
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
    html
  )
  if (!m) return []
  let list: ShelfEntry[]
  try {
    const data = JSON.parse(m[1]) as {
      props?: { pageProps?: { list?: ShelfEntry[] } }
    }
    list = data.props?.pageProps?.list ?? []
  } catch {
    return []
  }
  return list.slice(0, 25).map((it, i) => {
    const slug = it.book_title ? slugify(it.book_title) : ""
    return {
      id: `reelshort|${it.book_id ?? i}`,
      title: it.book_title ?? "",
      url:
        it.book_id && slug
          ? `https://www.reelshort.com/movie/${slug}-${it.book_id}`
          : "https://www.reelshort.com/shelf/top-short-movies-dramas-51004673",
      extra: `#${i + 1}`,
      image: it.book_pic || undefined,
      imageLarge: it.book_pic || undefined,
    }
  })
}
