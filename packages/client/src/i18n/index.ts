import { create } from 'zustand'
import { bg, type MessageKey } from './bg.js'
import { en } from './en.js'

export type Locale = 'bg' | 'en'
const DICTS: Record<Locale, Record<MessageKey, string>> = { bg, en }
const STORAGE = 'belot.locale'

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE) as Locale | null
  if (saved === 'bg' || saved === 'en') return saved
  const browser = (navigator.language || 'bg').toLowerCase()
  return browser.startsWith('bg') ? 'bg' : 'en'
}

type I18nState = {
  locale: Locale
  set: (l: Locale) => void
}

export const useI18n = create<I18nState>((set) => ({
  locale: typeof window === 'undefined' ? 'bg' : detectLocale(),
  set: (locale) => {
    localStorage.setItem(STORAGE, locale)
    document.documentElement.lang = locale
    set({ locale })
  },
}))

// Simple {placeholder} interpolation.
function interp(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

export function useT() {
  const locale = useI18n((s) => s.locale)
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    interp(DICTS[locale][key] ?? key, vars)
}
