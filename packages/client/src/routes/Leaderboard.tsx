import { useState } from 'react'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'

type Tab = 'weekly' | 'monthly' | 'all'

// Leaderboard page — per spec §4 КЛАСАЦИЯ.
// Tier A (atmospheric). Brass underline on active tab, no background highlight.
// Numbers in JetBrains Mono. Currently shows empty-state until DB is wired.
export function Leaderboard() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('weekly')

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />

      <main className="relative z-10 pt-24 sm:pt-28 pb-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={42} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">{t('lb.subtitle')}</div>
          <h1 className="font-display text-cream font-bold text-4xl sm:text-5xl lg:text-6xl leading-none">
            {t('lb.title')}
          </h1>
          <Flourish className="w-48 mx-auto mt-5 text-brass/40" />
        </motion.div>

        {/* Tabs — brass underline only on active, per spec */}
        <div className="flex items-center justify-center gap-1 mb-8">
          <TabBtn active={tab === 'weekly'} onClick={() => setTab('weekly')}>
            {t('lb.tabWeekly')}
          </TabBtn>
          <TabBtn active={tab === 'monthly'} onClick={() => setTab('monthly')}>
            {t('lb.tabMonthly')}
          </TabBtn>
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
            {t('lb.tabAllTime')}
          </TabBtn>
        </div>

        {/* Empty state — leaderboard backend not wired yet */}
        <div className="plate p-10 text-center">
          <div className="font-display italic text-cream/70 text-lg mb-2">{t('lb.empty')}</div>
          <div className="font-mono text-[10px] tracking-widest uppercase text-ash mt-4">
            {t('common.coming')}
          </div>
        </div>
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
      className={`relative px-4 py-2 font-mono text-xs tracking-[0.22em] uppercase transition ${
        active ? 'text-brass-hi' : 'text-ash hover:text-cream'
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="lb-tab-underline"
          className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  )
}
