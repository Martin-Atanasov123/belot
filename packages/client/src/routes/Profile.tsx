import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'
import { getNickname } from '../lib/identity.js'

// Profile page — per design spec §13 ПРОФИЛ.
// Skeleton implementation — data layer is Phase B+ (Supabase users + match history).
// Currently shows placeholders ("—") for all stats; the layout is complete so when
// the DB lands, only the data sources need to be wired.

export function Profile() {
  const t = useT()
  const { username = '' } = useParams<{ username: string }>()
  const myNick = getNickname()
  const isMe = !!myNick && myNick.toLowerCase() === username.toLowerCase()
  const initial = (username.trim()[0] ?? '?').toUpperCase()

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-60" />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Header — avatar + username + guest badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-8"
        >
          <div
            aria-hidden
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-brass/60 flex items-center justify-center font-display font-bold text-cream text-5xl bg-racing/70 shadow-lg"
          >
            {initial}
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="font-display italic text-cream text-3xl sm:text-4xl truncate">
                {username || '—'}
              </h1>
              {isMe && (
                <span className="font-mono text-[10px] tracking-[0.22em] uppercase px-2 py-0.5 bg-brass/15 border border-brass/40 text-brass-hi rounded">
                  {t('profile.youAre')}
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ash mt-1">
              {t('profile.guestBadge')}
            </div>
            {isMe && (
              <button disabled className="btn-ghost mt-3 opacity-50">
                {t('profile.editAvatar')} <span className="ml-2 text-[9px]">({t('common.coming')})</span>
              </button>
            )}
          </div>
          <Flourish className="hidden sm:block w-32 text-brass/30" />
        </motion.div>

        {/* Stats row */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="plate p-5 sm:p-6 mb-6"
        >
          <div className="eyebrow eyebrow-active mb-4">{t('profile.stats')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label={t('profile.totalWins')} value="—" />
            <StatCard label={t('profile.totalLosses')} value="—" />
            <StatCard label={t('profile.winRate')} value="—" />
            <StatCard label={t('profile.streak')} value="—" />
            <StatCard label={t('profile.favoriteContract')} value="—" />
          </div>
        </motion.section>

        {/* Two-column: history + combinations */}
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 sm:gap-6">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="eyebrow eyebrow-active">{t('profile.history')}</div>
              <span className="font-mono text-[10px] text-ash">{t('common.coming')}</span>
            </div>
            <div className="text-center py-10 font-display italic text-cream/55 text-sm">
              {t('profile.recentEmpty')}
            </div>
            <div className="text-center">
              <Link to="/tablo" className="btn-ghost">
                {t('profile.playFirst')}
              </Link>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="eyebrow eyebrow-active mb-4">{t('profile.combosHistory')}</div>
            <div className="space-y-2">
              <ComboRow label={t('profile.carrePieces')} value="0" />
              <ComboRow label={t('profile.quintaPieces')} value="0" />
              <ComboRow label={t('profile.belotPieces')} value="0" />
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-2 py-3 rounded border border-brass/15 bg-ink/40">
      <div className="eyebrow text-[9px]">{label}</div>
      <div className="font-mono text-brass-hi text-2xl sm:text-3xl mt-1.5">{value}</div>
    </div>
  )
}

function ComboRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-brass/10 last:border-0">
      <span className="font-display italic text-cream/75 text-sm">{label}</span>
      <span className="font-mono text-brass-hi text-lg">{value}</span>
    </div>
  )
}
