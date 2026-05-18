import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PublicNav } from '../components/PublicNav.js'
import { Flourish, Monogram } from '../components/Ornaments.js'
import { useT } from '../i18n/index.js'

// Tournament detail — per design spec §15. Skeleton view. Placeholder bracket SVG
// (decorative single-elim for 4 players). Real bracket renders from DB in Phase D.

export function TournamentDetail() {
  const t = useT()
  const { id = '' } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-ink relative">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-felt-noise opacity-60" />

      <main className="relative z-10 pt-20 sm:pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="flex justify-center mb-3">
            <Monogram size={36} />
          </div>
          <div className="eyebrow eyebrow-active mb-2">{t('tour.subtitle')}</div>
          <h1 className="font-display italic text-cream text-3xl sm:text-4xl lg:text-5xl leading-none">
            {t('tour.title')} № {id || '—'}
          </h1>
          <Flourish className="w-40 mx-auto mt-4 text-brass/40" />
        </motion.div>

        {/* Meta strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="plate p-5 sm:p-6 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          <MetaCell label={t('tour.format')} value={t('tour.formatSingleElim')} />
          <MetaCell label={t('tour.starts')} value="—" />
          <MetaCell label={t('tour.players')} value="0 / 8" />
        </motion.div>

        {/* Placeholder bracket */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="plate p-5 sm:p-8 mb-6"
        >
          <div className="eyebrow eyebrow-active mb-4">Bracket</div>
          <BracketSVG />
          <p className="text-center font-display italic text-cream/55 text-sm mt-4">
            {t('tour.bracketPlaceholder')}
          </p>
        </motion.div>

        <div className="text-center">
          <Link to="/turniri" className="btn-ghost">
            ← {t('tour.title')}
          </Link>
        </div>
      </main>
    </div>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-display italic text-cream/90 text-lg mt-1">{value}</div>
    </div>
  )
}

// Decorative 4-player single-elim bracket SVG. Empty slots, no live data.
function BracketSVG() {
  const W = 600
  const H = 220
  const slotW = 130
  const slotH = 36

  // Coordinate helpers — left column = R1 (2 matches), right column = final
  const r1x = 40
  const r2x = 320
  const r1y1 = 20
  const r1y2 = 70
  const r1y3 = 140
  const r1y4 = 190
  const finalY = (r1y1 + r1y4) / 2 - slotH / 2 + 24

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* R1 matches */}
      <Slot x={r1x} y={r1y1} w={slotW} h={slotH} />
      <Slot x={r1x} y={r1y2} w={slotW} h={slotH} />
      {/* connector → upper final */}
      <Line x1={r1x + slotW} y1={r1y1 + slotH / 2} x2={r2x} y2={finalY + slotH / 2} />
      <Line x1={r1x + slotW} y1={r1y2 + slotH / 2} x2={r2x} y2={finalY + slotH / 2} />

      <Slot x={r1x} y={r1y3} w={slotW} h={slotH} />
      <Slot x={r1x} y={r1y4} w={slotW} h={slotH} />
      {/* connector → lower final (in this 4-player view we just have 1 final) */}
      <Line
        x1={r1x + slotW}
        y1={r1y3 + slotH / 2}
        x2={r2x}
        y2={finalY + slotH * 1.5}
      />
      <Line
        x1={r1x + slotW}
        y1={r1y4 + slotH / 2}
        x2={r2x}
        y2={finalY + slotH * 1.5}
      />

      {/* Final */}
      <Slot x={r2x} y={finalY} w={slotW} h={slotH} highlight />
      <Slot x={r2x} y={finalY + slotH * 1.5} w={slotW} h={slotH} highlight />

      {/* Trophy slot */}
      <Slot x={r2x + slotW + 60} y={finalY + slotH * 0.75} w={slotW - 10} h={slotH} trophy />
      <Line
        x1={r2x + slotW}
        y1={finalY + slotH * 1.25}
        x2={r2x + slotW + 60}
        y2={finalY + slotH * 1.25}
      />
    </svg>
  )
}

function Slot({
  x,
  y,
  w,
  h,
  highlight,
  trophy,
}: {
  x: number
  y: number
  w: number
  h: number
  highlight?: boolean
  trophy?: boolean
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={w}
        height={h}
        rx="4"
        fill="#0e251c"
        stroke={trophy ? '#e6c178' : highlight ? '#c9a25a' : '#9aa39c'}
        strokeOpacity={trophy ? 1 : highlight ? 0.7 : 0.35}
        strokeWidth="1.5"
      />
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily='"JetBrains Mono", ui-monospace, monospace'
        fontSize="13"
        fill={trophy ? '#e6c178' : '#9aa39c'}
        letterSpacing="2"
      >
        {trophy ? '★' : '?'}
      </text>
    </g>
  )
}

function Line({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  // Render bracket connectors as right-angle lines (horizontal segment then vertical).
  const midX = (x1 + x2) / 2
  return (
    <g fill="none" stroke="#9aa39c" strokeOpacity="0.35" strokeWidth="1">
      <line x1={x1} y1={y1} x2={midX} y2={y1} />
      <line x1={midX} y1={y1} x2={midX} y2={y2} />
      <line x1={midX} y1={y2} x2={x2} y2={y2} />
    </g>
  )
}
