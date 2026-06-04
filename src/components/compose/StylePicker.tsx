"use client"

import type { DraftStyle } from "@/lib/compose-storage"

export interface StyleOption {
  id: DraftStyle
  icon: string
  label: string
  hint: string
}

export const STYLE_OPTIONS_EN: StyleOption[] = [
  { id: "deep",     icon: "📝", label: "Deep dive",       hint: "800–1200 words with analysis" },
  { id: "quick",    icon: "⚡", label: "Quick read",      hint: "2-minute scan, 400–600 words" },
  { id: "list",     icon: "📋", label: "Listicle",        hint: "Top-N with one-line takes" },
  { id: "personal", icon: "💬", label: "Personal take",   hint: "First-person commentary" },
  { id: "custom",   icon: "🛠", label: "Custom prompt",   hint: "Write your own instructions" },
]

export const STYLE_OPTIONS_ZH: StyleOption[] = [
  { id: "deep",     icon: "📝", label: "深度评论",   hint: "800–1200 字，带观点与分析" },
  { id: "quick",    icon: "⚡", label: "速读总结",   hint: "2 分钟看懂，400–600 字" },
  { id: "list",     icon: "📋", label: "列表体",     hint: "Top N + 一句话点评" },
  { id: "personal", icon: "💬", label: "个人观点",   hint: "第一人称，朋友圈风格" },
  { id: "custom",   icon: "🛠", label: "自定义",     hint: "自己写 prompt" },
]

interface Props {
  value: DraftStyle
  customPrompt: string
  onChange: (style: DraftStyle, customPrompt?: string) => void
  locale: "en" | "zh"
}

export function StylePicker({ value, customPrompt, onChange, locale }: Props) {
  const opts = locale === "zh" ? STYLE_OPTIONS_ZH : STYLE_OPTIONS_EN
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {opts.map((o) => {
          const active = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id, customPrompt)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-xs transition-colors text-center ${
                active
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-600 dark:text-zinc-400"
              }`}
              title={o.hint}
            >
              <span className="text-base leading-none">{o.icon}</span>
              <span className="font-medium leading-tight">{o.label}</span>
            </button>
          )
        })}
      </div>
      {value === "custom" && (
        <textarea
          value={customPrompt}
          onChange={(e) => onChange("custom", e.target.value)}
          placeholder={
            locale === "zh"
              ? "例：用脱口秀风格,加点调侃,800 字以内"
              : "e.g. Roast-comedy tone, snarky, under 600 words"
          }
          className="w-full min-h-[60px] resize-y rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 px-3 py-2 text-xs text-gray-700 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
      )}
    </div>
  )
}
