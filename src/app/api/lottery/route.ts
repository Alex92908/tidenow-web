import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

// 彩票历史数据与统计分析（7 个彩种）。都是 git 追踪的静态文件，不在请求时计算——
// 选号型一次完整分析（16方法 × 2零假设 × 5000置换 × 多种子）要十几分钟，
// 而函数上限 60 秒，差两个数量级。预计算 + 可下载原始 CSV，
// 让任何人都能自己重跑验证，比在网页上现算一个进度条诚实得多。
//
// GET /api/lottery                      → 全部彩种的分析结果
// GET /api/lottery?game=dlt&format=csv  → 该彩种全量历史开奖（下载）

export const revalidate = 3600

// 响应结构版本。改了 JSON 结构就把它 +1——
// 客户端把它带进 URL，浏览器会当成另一个资源，
// 旧的 1 小时缓存立刻失效。否则格式演进期间用户会拿着旧结构崩在页面上
// （这一条是实测踩出来的，不是预防性设计）。
export const SHAPE_VERSION = 2

const DIR = path.join(process.cwd(), "src", "data", "lottery")
// 白名单：文件名直接来自查询参数，必须限定取值，否则是路径穿越漏洞
const GAMES = ["dlt", "ssq", "qlc", "fc3d", "pl3", "pl5", "qxc"] as const

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format")
  const game = req.nextUrl.searchParams.get("game") ?? "dlt"

  try {
    if (format === "csv") {
      if (!(GAMES as readonly string[]).includes(game)) {
        return NextResponse.json({ error: "unknown game" }, { status: 400 })
      }
      const csv = await readFile(path.join(DIR, `${game}_history.csv`), "utf-8")
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${game}_history.csv"`,
          "cache-control": "public, max-age=3600",
        },
      })
    }
    const raw = await readFile(path.join(DIR, "lottery_analysis.json"), "utf-8")
    return new NextResponse(raw, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "lottery data not available" }, { status: 503 })
  }
}
