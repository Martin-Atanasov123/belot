import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'

// Premium page — per spec §3. Two pricing cards (Free vs Premium), feature
// comparison, FAQ accordion (TODO). Brass border on Premium card per spec.
// Billing not wired — clicking upgrade shows a coming-soon notice.
export function Premium() {
  const t = useT()
  const features: Array<{ label: string; free: boolean; paid: boolean }> = [
    { label: 'Casual игри без ограничения', free: true, paid: true },
    { label: 'Игра с приятели чрез линк', free: true, paid: true },
    { label: 'Игра с ботове', free: true, paid: true },
    { label: 'Достъп до турнири', free: false, paid: true },
    { label: 'История на всички игри', free: false, paid: true },
    { label: 'Персонализирани гърбове на карти', free: false, paid: true },
    { label: 'Без реклами', free: true, paid: true },
    { label: 'Приоритетно matchmaking', free: false, paid: true },
  ]

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="absolute inset-0 bg-felt-noise opacity-80 pointer-events-none" />
      {/* Atmospheric brass glow — Tier A allowed */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/2 translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #c9a25a 0%, transparent 60%)' }}
      />

      <main className="relative z-10 pt-24 sm:pt-28 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={42} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">Premium</div>
          <h1 className="font-display italic text-cream font-bold text-4xl sm:text-5xl lg:text-6xl leading-none">
            {t('prem.title')}
          </h1>
          <p className="font-display text-smoke mt-4 text-base sm:text-lg max-w-xl mx-auto">
            {t('prem.subtitle')}
          </p>
          <Flourish className="w-48 mx-auto mt-5 text-brass/40" />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 max-w-3xl mx-auto">
          {/* Free card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="plate p-6 sm:p-8"
          >
            <div className="eyebrow text-ash">{t('prem.free')}</div>
            <div className="font-display text-cream text-4xl mt-3 font-bold">0 лв</div>
            <div className="rule-brass my-5 opacity-50" />
            <ul className="space-y-2.5">
              {features.map((f) => (
                <FeatureLine key={f.label} label={f.label} on={f.free} />
              ))}
            </ul>
          </motion.div>

          {/* Premium card — brass border per spec */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="plate p-6 sm:p-8 border-2 border-brass/60 relative"
          >
            <div className="absolute -top-3 left-6 px-3 py-0.5 bg-brass text-stone-900 font-mono text-[10px] tracking-[0.22em] uppercase rounded-sm">
              Premium
            </div>
            <div className="eyebrow eyebrow-active">{t('prem.paid')}</div>
            <div className="font-display text-cream text-4xl mt-3 font-bold">
              4.99 лв<span className="text-base text-ash font-normal"> / месец</span>
            </div>
            <div className="rule-brass my-5" />
            <ul className="space-y-2.5">
              {features.map((f) => (
                <FeatureLine key={f.label} label={f.label} on={f.paid} brass={f.paid && !f.free} />
              ))}
            </ul>
            <button className="btn-brass w-full mt-6" disabled>
              {t('common.coming')}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

function FeatureLine({ label, on, brass }: { label: string; on: boolean; brass?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
          on
            ? brass
              ? 'bg-brass text-stone-900'
              : 'bg-brass/30 text-brass-hi'
            : 'bg-ash/15 text-ash/50'
        }`}
      >
        {on ? '✓' : '·'}
      </span>
      <span className={on ? 'text-cream/85' : 'text-ash/60 line-through'}>{label}</span>
    </li>
  )
}
