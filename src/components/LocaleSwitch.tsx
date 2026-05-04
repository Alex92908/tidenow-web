"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname } from "next/navigation"

export function LocaleSwitch() {
  const locale = useLocale()
  const t = useTranslations("locale")
  const router = useRouter()
  const pathname = usePathname()

  function toggle() {
    const next = locale === "zh" ? "en" : "zh"
    const withoutLocale = pathname.replace(/^\/(zh|en)/, "")
    router.push(`/${next}${withoutLocale || "/"}`)
  }

  return (
    <button
      onClick={toggle}
      className="text-sm px-3 py-1 rounded-full border border-zinc-700 hover:border-zinc-400 transition-colors text-zinc-400 hover:text-zinc-100"
    >
      {locale === "zh" ? t("en") : t("zh")}
    </button>
  )
}
