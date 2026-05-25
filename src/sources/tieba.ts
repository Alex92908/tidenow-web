import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "tieba", icon: "💬",
  accentColor: "bg-gradient-to-r from-teal-500 to-cyan-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 30,
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch("https://tieba.baidu.com/hottopic/browse/topicList", {
    headers: { Referer: "https://tieba.baidu.com/" },
  })
  const data = await res.json()
  const list = data?.data?.bang_topic?.topic_list ?? []
  return list.map((item: { topic_id: string; topic_name: string; topic_url: string; discuss_num?: number; topic_pic?: string; topic_avatar?: string }) => ({
    id: `tieba-${item.topic_id}`,
    title: item.topic_name,
    url: item.topic_url,
    extra: item.discuss_num ? `${item.discuss_num.toLocaleString()} 讨论` : undefined,
    image: item.topic_pic || item.topic_avatar,
  }))
}
