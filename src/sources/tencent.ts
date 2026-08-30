import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "tencent", icon: "🐧",
  accentColor: "bg-gradient-to-r from-blue-500 to-cyan-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://i.news.qq.com/web_backend/v2/getTagInfo?tagId=aEWqxLtdgmQ%3D",
    { headers: { Referer: "https://news.qq.com/" } }
  )
  const data = await res.json()
  return (data?.data?.tabs?.[0]?.articleList ?? [])
    .map(
      (item: {
        id: string
        // 上游偶尔返回只有 id/url/image、没有 title 的条目（实测抓到过），
        // 所以这里不能声明成必有的 string
        title?: string
        link_info?: { url?: string }
        desc?: string
        pic_info?: { small_img?: string[]; big_img?: string[] }
      }) => ({
        id: `tencent-${item.id}`,
        title: typeof item.title === "string" ? item.title.trim() : "",
        url: item.link_info?.url ?? `https://news.qq.com/`,
        image: item.pic_info?.small_img?.[0] || item.pic_info?.big_img?.[0],
      })
    )
    // 没有标题的条目对用户毫无意义，且会让下游任何 title.toLowerCase() 崩掉。
    // 在数据入口丢弃，比让每个消费方各自防御更可靠。
    .filter((it: NewsItem) => it.title.length > 0)
}
