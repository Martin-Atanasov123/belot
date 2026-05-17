import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useT } from '../i18n/index.js'
import { CornerOrnament, Flourish, Monogram } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'
import type { MessageKey } from '../i18n/bg.js'

// Maps known server / client error strings to friendly, localised messages.
// Anything not matched falls through to a generic subtitle + the raw error
// code (so users can paste it to a friend for debugging).
function classifyError(raw: string | null | undefined): {
  titleKey: MessageKey
  bodyKey: MessageKey
  showCode: boolean
} {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('not found') || s.includes('room gone') || s.includes('not in a room')) {
    return { titleKey: 'error.notFoundTitle', bodyKey: 'error.notFoundBody', showCode: false }
  }
  if (s.includes('connection') || s.includes('socket') || s.includes('network')) {
    return { titleKey: 'error.title', bodyKey: 'error.connection', showCode: false }
  }
  return { titleKey: 'error.title', bodyKey: 'error.subtitle', showCode: Boolean(raw) }
}

export function ErrorScreen({
  errorCode,
  titleKey,
  bodyKey,
  onRetry,
}: {
  // Raw error string returned by the server (e.g. "room not found", "room full").
  errorCode?: string | null
  // Optional override — used by the 404 catch-all route which has its own copy.
  titleKey?: MessageKey
  bodyKey?: MessageKey
  // If provided, renders a "Try again" button alongside the home link.
  onRetry?: () => void
}) {
  const t = useT()
  const classified = classifyError(errorCode)
  const finalTitleKey: MessageKey = titleKey ?? classified.titleKey
  const finalBodyKey: MessageKey = bodyKey ?? classified.bodyKey
  const showCode = !titleKey && classified.showCode

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-90" />
      <div
        className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #7d1f2b 0%, transparent 60%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c9a25a 0%, transparent 60%)' }}
      />

      <CornerOrnament className="absolute top-4 left-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/40" />
      <CornerOrnament
        className="absolute top-4 right-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/40"
        style={{ transform: 'scaleX(-1)' } as React.CSSProperties}
      />
      <CornerOrnament
        className="absolute bottom-4 left-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/40"
        style={{ transform: 'scaleY(-1)' } as React.CSSProperties}
      />
      <CornerOrnament
        className="absolute bottom-4 right-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/40"
        style={{ transform: 'scale(-1,-1)' } as React.CSSProperties}
      />

      <LanguageToggle className="absolute top-5 right-5 z-30" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg plate p-7 sm:p-10 text-center border border-ember-hi/30"
      >
        <div className="flex justify-center mb-4">
          <Monogram size={48} />
        </div>

        <div className="eyebrow text-ember-hi">{t('common.error')}</div>

        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="font-display text-cream font-bold mt-3 leading-tight"
          style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}
        >
          {t(finalTitleKey)}
        </motion.h1>

        <div className="rule-brass mx-auto mt-4 w-1/2" />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="font-display italic text-cream/75 mt-5 text-base sm:text-lg leading-relaxed"
        >
          {t(finalBodyKey)}
        </motion.p>

        {showCode && errorCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-5 mx-auto inline-flex items-center gap-2 px-3 py-1.5 rounded border border-ash/25 bg-ash/5"
          >
            <span className="eyebrow text-ash text-[9px]">{t('error.code')}</span>
            <code className="font-mono text-ash text-xs">{errorCode}</code>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-7 flex flex-col sm:flex-row gap-3 justify-center"
        >
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-brass px-6 py-2.5">
              {t('error.tryAgain')}
            </button>
          )}
          <Link to="/" className="btn-ghost px-6 py-2.5 text-center">
            {t('error.goHome')}
          </Link>
        </motion.div>

        <Flourish className="w-40 mx-auto mt-7 text-brass/40" />
      </motion.div>
    </div>
  )
}

// Dedicated 404 page — used by the catch-all route in main.tsx.
export function NotFoundScreen() {
  return (
    <ErrorScreen titleKey="error.404Title" bodyKey="error.404Body" />
  )
}
