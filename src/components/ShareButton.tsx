"use client"

import { useState, useRef } from "react"
import { createPortal } from "react-dom"
import { useTranslations, useLocale } from "next-intl"
import type { NewsItem } from "@/lib/types"

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="12" cy="13" r="1.5" />
      <circle cx="4" cy="8" r="1.5" />
      <path d="M10.5 3.75L5.5 7.25M10.5 12.25L5.5 8.75" strokeLinecap="round" />
    </svg>
  )
}

interface ShareButtonProps {
  item: Pick<NewsItem, "title" | "url">
  className?: string
}

export function ShareButton({ item, className }: ShareButtonProps) {
  const t = useTranslations("source")
  const locale = useLocale()
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [copied, setCopied] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  function openShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (navigator.share) {
      navigator.share({ title: item.title, url: item.url }).catch(() => {})
      return
    }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const menuWidth = 192
      const menuHeight = 240
      let left = r.right - menuWidth
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))
      const openUp = r.bottom + menuHeight + 4 > window.innerHeight - 8
      const top = openUp ? r.top - menuHeight - 4 : r.bottom + 4
      setMenuPos({ top, left })
    }
    setShowMenu((v) => !v)
  }

  async function copyLink(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(item.url)
    } catch {
      const el = document.createElement("textarea")
      el.value = item.url
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => { setCopied(false); setShowMenu(false) }, 1500)
  }

  const encoded = encodeURIComponent(item.url)
  const encodedTitle = encodeURIComponent(item.title)
  const socials = [
    { label: locale === "zh" ? "微博" : "Weibo", href: `https://service.weibo.com/share/share.php?url=${encoded}&title=${encodedTitle}` },
    { label: "X",        href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encoded}&text=${encodedTitle}` },
    { label: "Gmail",    href: `https://mail.google.com/mail/?view=cm&su=${encodedTitle}&body=${encoded}` },
    { label: "TikTok",   href: `https://www.tiktok.com/upload?url=${encoded}` },
  ]

  return (
    <>
      <button
        ref={btnRef}
        onClick={openShare}
        className={className ?? "shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-zinc-700 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 active:scale-90 transition-all"}
        title={t("share")}
      >
        <ShareIcon />
      </button>

      {showMenu && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
          <div
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[101] w-48 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg dark:shadow-black/40 overflow-hidden"
          >
            <button
              onClick={copyLink}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              {copied ? (
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-green-500" stroke="currentColor" strokeWidth="2">
                  <path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="4" width="10" height="11" rx="1.5" />
                  <path d="M5 4V2.5A1.5 1.5 0 016.5 1h8A1.5 1.5 0 0116 2.5v8A1.5 1.5 0 0114.5 12H13" strokeLinecap="round" />
                </svg>
              )}
              {copied ? t("copied") : t("copyLink")}
            </button>
            <div className="h-px bg-gray-100 dark:bg-white/[0.06]" />
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("shareTo", { name: s.label })}
              </a>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
