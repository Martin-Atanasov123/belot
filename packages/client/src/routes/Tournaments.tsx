import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'

// Tournaments list — per design spec §14 ТУРНИРИ.
// Tier A atmospheric. Tabs filter Upcoming / Active / Finished.
// No backend yet; every tab shows the same "no tournaments scheduled" empty state.

type Tab = 'upcoming' | 'active' | 'finished'

export function Tournaments() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('upcoming')

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-70" />
      {/* Atmospheric brass glow — Tier A allowed */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-12 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c9a25a 0%, transparent 60%)' }}
      />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={42} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">{t('tour.subtitle')}</div>
          <h1 className="font-display italic text-cream font-bold text-4xl sm:text-5xl lg:text-6xl leading-none">
            {t('tour.title')}
          </h1>
          <Flourish className="w-48 mx-auto mt-5 text-brass/40" />
        </motion.div>

        {/* Tabs — brass underline on active */}
        <div className="flex items-center justify-center gap-1 mb-8 overflow-x-auto">
          <TabBtn active={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
            {t('tour.upcoming')}
          </TabBtn>
          <TabBtn active={tab === 'active'} onClick={() => setTab('active')}>
            {t('tour.active')}
          </TabBtn>
          <TabBtn active={tab === 'finished'} onClick={() => setTab('finished')}>
            {t('tour.finished')}
          </TabBtn>
        </div>

        {/* Empty state */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="plate p-10 text-center"
        >
          <div className="font-display italic text-cream/70 text-lg mb-3">{t('tour.empty')}</div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ash">
            {t('tour.regOpens')}
          </div>
          <div className="mt-6">
            <Link to="/premium" className="btn-ghost">
              {t('tour.locked')} ★
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 font-mono text-xs tracking-[0.22em] uppercase transition shrink-0 ${
        active ? 'text-brass-hi' : 'text-ash hover:text-cream'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="tour-tab-underline"
          className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  )
}
