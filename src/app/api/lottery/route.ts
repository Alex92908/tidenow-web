import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

// 大乐透历史数据与回测结果。两者都是 git 追踪的静态文件，不在请求时计算——
// 一次完整回测（16方法 × 2零假设 × 5000置换 × 多种子）要十几分钟，
// 而函数上限 60 秒，差两个数量级。预计算 + 可下载原始 CSV，
// 让任何人都能自己重跑验证，比在网页上现算一个进度条诚实得多。
//
// GET /api/lottery              → 回测结果 JSON
// GET /api/lottery?format=csv   → 原始开奖数据（下载）

export const revalidate = 3600

const DIR = path.join(process.cwd(), "src", "data", "lottery")

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format")
  try {
    if (format === "csv") {
      const csv = await readFile(path.join(DIR, "dlt_history.csv"), "utf-8")
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="dlt_history.csv"',
          "cache-control": "public, max-age=3600",
        },
      })
    }
    const raw = await readFile(path.join(DIR, "dlt_analysis.json"), "utf-8")
    return new NextResponse(raw, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json(
      { error: "lottery data not available" },
      { status: 503 }
    )
  }
}
