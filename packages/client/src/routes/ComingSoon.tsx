import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { PublicNav } from '../components/PublicNav.js'
import { useT } from '../i18n/index.js'
import type { MessageKey } from '../i18n/bg.js'

// Generic "coming soon" page used by all the Tier A routes whose backend
// hasn't been built yet (Leaderboard, Premium, Tournaments, Profile, Settings,
// Tablo, Auth pages). Each one passes its own titleKey/bodyKey + optional
// preview content so the route is navigable from day one — even though the
// real feature ships later.
export function ComingSoon({
  titleKey,
  subtitleKey,
  preview,
}: {
  titleKey: MessageKey
  subtitleKey?: MessageKey
  preview?: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />

      <main className="relative z-10 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={42} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">{t('common.coming')}</div>
          <h1
            className="font-display text-cream font-bold leading-tight"
            style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
          >
            {t(titleKey)}
          </h1>
          {subtitleKey && (
            <p className="font-display italic text-smoke mt-4 text-lg sm:text-xl max-w-2xl mx-auto">
              {t(subtitleKey)}
            </p>
          )}
          <Flourish className="w-48 mx-auto mt-6 text-brass/40" />
        </motion.div>

        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mb-10"
          >
            {preview}
          </motion.div>
        )}

        <div className="text-center">
          <Link to="/" className="btn-ghost">{t('error.goHome')}</Link>
        </div>
      </main>
    </div>
  )
}
