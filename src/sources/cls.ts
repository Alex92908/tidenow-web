import crypto from "node:crypto"
import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "cls", icon: "📡",
  accentColor: "bg-gradient-to-r from-red-500 to-rose-400",
  interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

// CLS rotated their public news-flash API in mid-2026: the old
// `/nodeapi/updateTelegraphList` now 404s, and the new
// `/v1/roll/get_roll_list` requires every request to carry a `sign`
// query param. Reverse-engineered from their page chunk
// telegraph-*.js: sort params alphabetically, build the query string,
// sha1 it, then md5 the sha1 hex digest.
function buildSignedUrl(endpoint: string, params: Record<string, string>): string {
  const qs = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  const sha = crypto.createHash("sha1").update(qs).digest("hex")
  const sign = crypto.createHash("md5").update(sha).digest("hex")
  return `${endpoint}?${qs}&sign=${sign}`
}

export async function fetch(): Promise<NewsItem[]> {
  const url = buildSignedUrl("https://www.cls.cn/v1/roll/get_roll_list", {
    app: "CailianpressWeb",
    os: "web",
    rn: "30",
    sv: "8.4.6",
  })
  const res = await myFetch(url, {
    headers: { Referer: "https://www.cls.cn/telegraph" },
  })
  const data = await res.json()
  return (data?.data?.roll_data ?? [])
    .filter((k: { is_ad?: number }) => !k.is_ad)
    .slice(0, 30)
    .map((k: { id: number; title?: string; brief?: string; content?: string; ctime?: number }) => {
      const raw = k.title || k.brief || k.content || ""
      // content is like 【title】desc — extract title from brackets
      const bracketMatch = raw.match(/^【([^】]+)】/)
      const title = bracketMatch ? bracketMatch[1] : raw.substring(0, 60)
      return {
        id: `cls-${k.id}`,
        title,
        url: `https://www.cls.cn/detail/${k.id}`,
      }
    })
}
