export type FontSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"

const SIZES: Record<FontSize, string> = {
  xs:  "11px",
  sm:  "12px",
  md:  "13px",
  lg:  "14px",
  xl:  "15px",
  "2xl": "16px",
  "3xl": "17px",
  "4xl": "18px",
  "5xl": "20px",
}

export const STEPS: FontSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"]

const STORAGE_KEY = "tidenow-font-size"

export function getFontSize(): FontSize {
  if (typeof window === "undefined") return "md"
  return (localStorage.getItem(STORAGE_KEY) as FontSize) ?? "md"
}

export function saveFontSize(size: FontSize) {
  localStorage.setItem(STORAGE_KEY, size)
  applyFontSize(size)
}

export function applyFontSize(size: FontSize) {
  document.documentElement.style.setProperty("--news-font-size", SIZES[size])
}

export function stepFontSize(current: FontSize, dir: 1 | -1): FontSize {
  const idx = STEPS.indexOf(current)
  const next = idx + dir
  if (next < 0 || next >= STEPS.length) return current
  return STEPS[next]
}
