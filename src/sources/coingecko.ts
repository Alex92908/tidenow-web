import { myFetch } from "@/lib/fetch"
import type { NewsItem, SourceMeta } from "@/lib/types"

export const meta: SourceMeta = {
  id: "coingecko",
  icon: "🪙",
  accentColor: "bg-gradient-to-r from-amber-500 to-yellow-400",
  interval: 15 * 60 * 1000,
  defaultCount: 10,
  expandCount: 25,
  column: "finance",
}

// CoinGecko top coins by market cap — free public API, no key.
// 15-min interval keeps us far under the free-tier rate limit.
// https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false
type Coin = {
  id?: string
  symbol?: string
  name?: string
  image?: string
  current_price?: number
  price_change_percentage_24h?: number
}

function fmtPrice(n: number): string {
  return n >= 1
    ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `$${n.toFixed(4)}`
}

export async function fetch(): Promise<NewsItem[]> {
  const res = await myFetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false",
    { headers: { Accept: "application/json" } }
  )
  if (!res.ok) return []
  const data = (await res.json()) as Coin[]
  if (!Array.isArray(data)) return []
  return data
    .filter((c) => c.id && c.name)
    .map((c, i) => {
      const change = c.price_change_percentage_24h
      const changeStr =
        typeof change === "number"
          ? ` ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`
          : ""
      const priceStr =
        typeof c.current_price === "number" ? fmtPrice(c.current_price) : ""
      return {
        id: `coingecko|${c.id}`,
        title: `${c.name} (${(c.symbol ?? "").toUpperCase()})`,
        url: `https://www.coingecko.com/en/coins/${c.id}`,
        extra: [priceStr, changeStr.trim()].filter(Boolean).join(" · ") || `#${i + 1}`,
        image: c.image,
        imageLarge: c.image,
      }
    })
}
