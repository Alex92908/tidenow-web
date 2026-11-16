import Link from "next/link"

// Real 404 page. Previously this was a client component that silently
// did router.replace("/") on mount, so any mistyped or stale link showed
// a blank white page and then bounced to the homepage. The HTTP status
// was already a correct 404; this keeps it a 404 and gives the visitor
// a way back instead of a blank redirect.
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center bg-white dark:bg-[#0a0a0f]">
      <p className="text-6xl font-bold tracking-tight text-gray-200 dark:text-zinc-800 select-none">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-zinc-100">
        Page not found · 页面不存在
      </h1>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
        The link may be mistyped, or the post was moved or removed.
        <br />
        链接可能输错了，或者这篇文章已经被移动或删除。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors"
        >
          ← TideNow home · 回到首页
        </Link>
        <Link
          href="/posts"
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-sm text-gray-600 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
        >
          All posts · 全部文章
        </Link>
      </div>
    </main>
  )
}
