import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "xueqiu", icon: "❄️",
  accentColor: "bg-gradient-to-r from-sky-500 to-blue-400",
  interval: 10 * 60 * 1000, defaultCount: 10, expandCount: 25,
}

export async function fetch(): Promise<NewsItem[]> {
  const cookieRes = await myFetch("https://xueqiu.com/hq", {
    headers: { Referer: "https://xueqiu.com/" },
  })
  // getSetCookie() returns an array — avoids the folded comma problem
  const allCookies: string[] =
    (cookieRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (cookieRes.headers.get("set-cookie") ?? "").split(/,\s*(?=[a-z_]+=)/i)
  const cookieStr = allCookies.map((c) => c.split(";")[0]).join("; ")

  const res = await myFetch(
    "https://stock.xueqiu.com/v5/stock/hot_stock/list.json?size=30&_type=10&type=10",
    { headers: { Referer: "https://xueqiu.com/", Cookie: cookieStr } }
  )
  const data = await res.json()
  return (data?.data?.items ?? [])
    .filter((item: { ad?: number }) => !item.ad)
    .map((item: { code: string; name: string; percent?: number; exchange?: string }) => ({
      id: `xueqiu-${item.code}`,
      title: `${item.name}（${item.code}）`,
      url: `https://xueqiu.com/S/${item.code}`,
      extra: item.percent != null
        ? `${item.percent > 0 ? "+" : ""}${item.percent.toFixed(2)}%`
        : undefined,
    }))
}
