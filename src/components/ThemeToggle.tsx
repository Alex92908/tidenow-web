"use client"

import { useTheme } from "./ThemeProvider"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-base"
      title={theme === "dark" ? "切换白天模式" : "切换黑暗模式"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  )
}
