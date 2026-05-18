import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { CornerOrnament, Flourish, Monogram } from '../components/Ornaments.js'
import { createRoom } from '../lib/api.js'
import { getNickname, getPlayerIdFor } from '../lib/identity.js'
import { useAuth } from '../lib/auth.js'
import { useT } from '../i18n/index.js'

// Lobby hub (Табло) — per design spec §8. Main authenticated hub.
// Currently runs in "guest mode" — uses the local nickname (no real auth yet).
// Atmospheric (Tier A): corner ornaments, plate panels, brass accents.
// Quick actions row at the top, active rooms list, recent games, stats sidebar.
//
// TODO when auth lands: gate behind `useAuth()`; pull real stats from DB.
export function Tablo() {
  const t = useT()
  const nav = useNavigate()
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  // Signed-in users keep their profile username; guests fall back to localStorage.
  const nick = (profile?.username ?? user?.email?.split('@')[0] ?? getNickname()) || 'Гост'
  const [busy, setBusy] = useState(false)
  const [joinCode, setJoinCode] = useState('')

  const onCreate = async () => {
    setBusy(true)
    try {
      // Authed users get a stable playerId derived from their auth uid;
      // guests get the localStorage-cached uuid keyed by nickname.
      const playerId = user?.id ?? getPlayerIdFor(nick)
      const { code } = await createRoom(playerId)
      nav(`/r/${code}?host=1`)
    } finally {
      setBusy(false)
    }
  }
  const onJoin = () => {
    const c = joinCode.trim().toUpperCase()
    if (c) nav(`/r/${c}`)
  }

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />

      <CornerOrnament className="absolute top-20 left-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/25" />
      <CornerOrnament
        className="absolute top-20 right-4 w-9 h-9 sm:w-12 sm:h-12 text-brass/25"
        style={{ transform: 'scaleX(-1)' } as React.CSSProperties}
      />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-6 sm:mb-8"
        >
          <Monogram size={38} />
          <div>
            <div className="eyebrow">{t('tablo.greeting')}</div>
            <div className="font-display italic text-cream text-2xl sm:text-3xl">{nick}</div>
          </div>
        </motion.div>

        {/* Quick actions — primary CTA + secondary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8"
        >
          <button onClick={onCreate} disabled={busy} className="btn-brass">
            {busy ? t('landing.creating') : t('tablo.newRoom')}
          </button>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder={t('landing.codePh')}
              className="input-salon flex-1 font-mono text-center tracking-[0.32em] uppercase"
            />
            <button onClick={onJoin} className="btn-ghost shrink-0">
              {t('landing.join')}
            </button>
          </div>
          <button disabled className="btn-ghost">
            {t('tablo.quickPlay')} <span className="ml-2 text-[9px] opacity-60">({t('common.coming')})</span>
          </button>
        </motion.div>

        {/* Two-column area: active rooms + stats sidebar */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-5 sm:gap-6">
          {/* LEFT: active rooms */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="eyebrow">{t('tablo.activeRooms')}</div>
              <span className="font-mono text-[10px] text-ash">{t('common.coming')}</span>
            </div>
            <div className="text-center py-10 font-display italic text-cream/55 text-sm">
              {t('tablo.activeEmpty')}
            </div>
            <Flourish className="w-32 mx-auto text-brass/30 mt-6" />

            <div className="mt-8">
              <div className="eyebrow mb-3">{t('tablo.recentGames')}</div>
              <div className="text-center py-6 font-display italic text-cream/55 text-sm">
                {t('tablo.recentEmpty')}
              </div>
            </div>
          </motion.section>

          {/* RIGHT: stats sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.5 }}
            className="plate p-5 sm:p-6"
          >
            <div className="eyebrow mb-4">{t('tablo.statsTitle')}</div>
            <StatRow label={t('tablo.statsWinsWeek')} value="—" />
            <StatRow label={t('tablo.statsStreak')} value="—" />
            <StatRow label={t('tablo.statsTotal')} value="—" />
            <div className="mt-6 pt-4 border-t border-brass/15 text-center">
              <Link to="/registracia" className="font-mono text-[10px] tracking-[0.22em] uppercase text-brass-hi hover:underline">
                {t('nav.signup')} →
              </Link>
            </div>
          </motion.aside>
        </div>
      </main>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-brass/10 last:border-0">
      <span className="font-display italic text-cream/70 text-sm">{label}</span>
      <span className="font-mono text-brass-hi text-lg">{value}</span>
    </div>
  )
}
