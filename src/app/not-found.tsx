import Link from "next/link"

// Real 404 page, fully self-contained with INLINE styles. Next.js serves
// this as its error shell (<html id="__next_error__">) WITHOUT loading
// globals.css, so Tailwind classes here do nothing — the previous version
// rendered as unstyled plain HTML. Every visual rule below is a style
// prop (no class names, no globals.css dependency). The outer container
// is position:fixed + inset:0 so it covers the viewport regardless of
// the shell's default body margin. The HTTP status stays a real 404;
// there is no redirect.
export default function NotFound() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 16px",
        textAlign: "center",
        background: "#0a0a0f",
        color: "#f4f4f5",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 96,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          color: "#27272a",
          userSelect: "none",
        }}
      >
        404
      </p>
      <h1
        style={{
          margin: "16px 0 0",
          fontSize: 20,
          fontWeight: 600,
          color: "#fafafa",
        }}
      >
        Page not found · 页面不存在
      </h1>
      <p
        style={{
          margin: "8px 0 0",
          maxWidth: 448,
          fontSize: 14,
          lineHeight: 1.7,
          color: "#a1a1aa",
        }}
      >
        The link may be mistyped, or the post was moved or removed.
        <br />
        链接可能输错了，或者这篇文章已经被移动或删除。
      </p>
      <div
        style={{
          marginTop: 32,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 8,
            background: "#0ea5e9",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          ← TideNow home · 回到首页
        </Link>
        <Link
          href="/posts"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#d4d4d8",
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          All posts · 全部文章
        </Link>
      </div>
    </main>
  )
}
