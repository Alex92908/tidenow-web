"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

/**
 * Share row for article pages (Phase 3): X, Weibo, copy-link.
 * Plain share URLs only — no OAuth, no SDKs, no tracking.
 */
export function ShareBar({
  title,
  url,
  locale,
}: {
  title: string
  url: string
  locale: "en" | "zh"
}) {
  const t = useTranslations("posts")
  const [copied, setCopied] = useState(false)

  const encoded = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  const links = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`,
    },
    {
      label: locale === "zh" ? "微博" : "Weibo",
      href: `https://service.weibo.com/share/share.php?url=${encoded}&title=${encodedTitle}`,
    },
  ]

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement("textarea")
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const pill =
    "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-sm transition-all active:scale-95"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 mr-1">
        {t("share")}
      </span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={pill}
        >
          {l.label}
        </a>
      ))}
      <button onClick={copyLink} className={pill}>
        {copied ? (
          <>
            <span className="text-emerald-500">✓</span> {t("copied")}
          </>
        ) : (
          <>🔗 {locale === "zh" ? "复制链接" : "Copy link"}</>
        )}
      </button>
    </div>
  )
}
