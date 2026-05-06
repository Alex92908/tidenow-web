export type AIProvider = "anthropic" | "openai" | "deepseek" | "zhipu" | "gemini"

export interface AISettings {
  provider: AIProvider
  apiKey: string
}

export const PROVIDER_META: Record<AIProvider, { label: string; placeholder: string; url: string }> = {
  anthropic: {
    label: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    url: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    label: "OpenAI (GPT)",
    placeholder: "sk-...",
    url: "https://platform.openai.com/api-keys",
  },
  deepseek: {
    label: "DeepSeek",
    placeholder: "sk-...",
    url: "https://platform.deepseek.com/api_keys",
  },
  zhipu: {
    label: "智谱 AI (GLM)",
    placeholder: "your-zhipu-api-key",
    url: "https://open.bigmodel.cn/usercenter/apikeys",
  },
  gemini: {
    label: "Google Gemini",
    placeholder: "AIza...",
    url: "https://aistudio.google.com/app/apikey",
  },
}

const STORAGE_KEY = "tidenow-ai-settings"

export function getAISettings(): AISettings | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearAISettings() {
  localStorage.removeItem(STORAGE_KEY)
}
