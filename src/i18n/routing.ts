import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "en",
  localePrefix: "as-needed", // "/" = English, "/zh" = Chinese
  localeDetection: false,    // never auto-redirect based on browser language
})
