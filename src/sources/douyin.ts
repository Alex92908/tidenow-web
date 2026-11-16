import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "douyin", icon: "🎵",
  accentColor: "bg-gradient-to-r from-pink-500 to-fuchsia-400",
  interval: 5 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  // Get session cookie first
  const cookieRes = await myFetch("https://www.douyin.com/", {
    headers: { Referer: "https://www.douyin.com/" },
  })
  // Get session cookie first. getSetCookie() (undici / Node 18+) returns
  // each cookie separately. The old code split the joined header on ",",
  // which corrupts cookies whose Expires date contains a comma
  // ("Expires=Wed, 05 Apr 2023 ...") and produced an invalid Cookie
  // header, so the hot-list call failed intermittently.
  const headers = cookieRes.headers as Headers & { getSetCookie?: () => string[] }
  let cookiePairs: string[]
  if (typeof headers.getSetCookie === "function") {
    cookiePairs = headers
      .getSetCookie()
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
  } else {
    // Fallback: split only on a comma that starts a new cookie (comma +
    // optional space + a token containing "="). Commas inside Expires
    // dates are followed by a day number, not "name=".
    const setCookie = headers.get("set-cookie") ?? ""
    cookiePairs = setCookie
      .split(/,\s*(?=[^;,=]+=)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
  }
  const cookie = cookiePairs.join("; ")

  const res = await myFetch(
    "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1",
    {
      headers: {
        Referer: "https://www.douyin.com/",
        Cookie: cookie,
      },
    }
  )
  const data = await res.json()
  return (data?.data?.word_list ?? []).map(
    (item: {
      sentence_id: string
      word: string
      hot_value?: number
      word_cover?: { url_list?: string[] }
    }) => ({
      id: `douyin-${item.sentence_id}`,
      title: item.word,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.word)}`,
      extra: item.hot_value ? `🔥 ${item.hot_value.toLocaleString()}` : undefined,
      image: item.word_cover?.url_list?.[0],
    })
  )
}
