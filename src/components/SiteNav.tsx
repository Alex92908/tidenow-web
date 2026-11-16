// Persistent site nav — lives in [locale]/layout.tsx so it appears on
// every page. Logo | Trending | Takes | Write | Predict with clear text
// labels (not icon-only) and an active state for the current page.
// Homepage-only board tools (font size, AI settings, filters) are shown
// only on the board itself; theme + locale switchers are always visible.
"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { LocaleSwitch } from "@/components/LocaleSwitch"
import { ThemeToggle } from "@/components/ThemeToggle"
import { AISettingsButton } from "@/components/AISettingsButton"
import { FilterSettingsButton } from "@/components/FilterSettingsButton"
import { FontSizeControl } from "@/components/FontSizeControl"

const FEEDBACK_EMAIL = "alex.chu0206@gmail.com"

type NavId = "trending" | "takes" | "write" | "predict"

export function SiteNav({ locale }: { locale: string }) {
  const pathname = usePathname()
  const tSite = useTranslations("site")
  const tFooter = useTranslations("footer")

  const homeHref = locale === "zh" ? "/zh" : "/"
  // Predict is behind the same kill switch the old header used: hidden
  // when the ForeSight engine is disabled at build time.
  const predictEnabled = process.env.NEXT_PUBLIC_FORESIGHT_ENABLED !== "0"
  const links: { id: NavId; href: string; label: string; icon?: string }[] = [
    { id: "trending", href: homeHref, label: tSite("navTrending") },
    { id: "takes", href: locale === "zh" ? "/zh/posts" : "/posts", label: tSite("navTakes") },
    { id: "write", href: locale === "zh" ? "/zh/compose" : "/compose", label: tSite("navWrite"), icon: "✍️" },
    ...(predictEnabled
      ? [{ id: "predict" as NavId, href: locale === "zh" ? "/zh/predict" : "/predict", label: tSite("navPredict"), icon: "🔮" }]
      : []),
  ]

  // Active page: strip the /zh prefix, then match the first segment.
  // /posts/[slug] counts as Takes; /source/[id] counts as Trending.
  const path = (pathname ?? "/").replace(/^\/zh(?=\/|$)/, "") || "/"
  const active: NavId = path.startsWith("/posts")
    ? "takes"
    : path.startsWith("/compose")
      ? "write"
      : path.startsWith("/predict")
        ? "predict"
        : "trending"
  const isHome = path === "/"

  const feedbackHref = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    tFooter("feedbackSubject")
  )}&body=${encodeURIComponent(tFooter("feedbackBody"))}`

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        {/* Logo → home */}
        <a href={homeHref} className="flex items-center shrink-0 select-none" aria-label="TideNow">
          <span
            className="text-[1.35rem] font-bold text-gray-900 dark:text-white tracking-tight leading-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Tide
          </span>
          <span
            className="text-[1.35rem] font-normal text-sky-500 dark:text-sky-400 tracking-tight leading-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Now
          </span>
        </a>

        {/* Nav links — horizontally scrollable on narrow screens */}
        <nav className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar" aria-label="Site">
          {links.map((link) => {
            const isActive = active === link.id
            return (
              <a
                key={link.id}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex items-center gap-1.5 px-3 h-8 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                  isActive
                    ? "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10"
                    : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5",
                ].join(" ")}
              >
                {link.icon && <span className="text-sm leading-none">{link.icon}</span>}
                <span>{link.label}</span>
              </a>
            )
          })}
        </nav>

        {/* Right side — feedback + tools */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <a
            href={feedbackHref}
            title={tFooter("feedback")}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
          >
            <span className="text-sm leading-none">💬</span>
            <span className="hidden sm:inline">{tFooter("feedback")}</span>
          </a>
          {isHome && (
            <>
              <FontSizeControl />
              <FilterSettingsButton locale={locale} />
            </>
          )}
          {/* AI key setting is always visible: the key is needed on every
              page (summaries on the board + source pages, generate /
              rewrite on /compose), and the "set one in ✦ above" hint
              points at it from pages where it used to be hidden. */}
          <AISettingsButton locale={locale} />
          <ThemeToggle />
          <LocaleSwitch />
        </div>
      </div>
    </header>
  )
}
