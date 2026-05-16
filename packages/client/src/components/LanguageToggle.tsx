import { useI18n, useT } from '../i18n/index.js'

export function LanguageToggle({ className = '' }: { className?: string }) {
  const t = useT()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.set)
  const next = locale === 'bg' ? 'en' : 'bg'

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className={`group plate inline-flex items-center gap-1.5 px-2.5 py-1.5 ${className}`}
      title={`Switch to ${next === 'bg' ? 'Български' : 'English'}`}
    >
      <span
        className={`font-mono text-[10px] tracking-[0.22em] ${
          locale === 'bg' ? 'text-brass' : 'text-ash'
        }`}
      >БГ</span>
      <span className="text-ash/40">/</span>
      <span
        className={`font-mono text-[10px] tracking-[0.22em] ${
          locale === 'en' ? 'text-brass' : 'text-ash'
        }`}
      >EN</span>
      <span className="sr-only">{t('lang.toggle')}</span>
    </button>
  )
}
