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
  const setCookie = cookieRes.headers.get("set-cookie") ?? ""
  const cookie = setCookie.split(";").map(s => s.split(",").pop()?.split(";")[0]).filter(Boolean).join("; ")

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
    (item: { sentence_id: string; word: string; hot_value?: number }) => ({
      id: `douyin-${item.sentence_id}`,
      title: item.word,
      url: `https://www.douyin.com/search/${encodeURIComponent(item.word)}`,
      extra: item.hot_value ? `🔥 ${item.hot_value.toLocaleString()}` : undefined,
    })
  )
}
