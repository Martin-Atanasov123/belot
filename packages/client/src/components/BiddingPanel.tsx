import { motion } from 'framer-motion'
import type { BidContract } from '@belot/shared'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'

// Bidding panel — Tier B (Battlefield) per design spec §17 НАДДАВАНЕ.
// Design rules applied here:
// — Min 44px tap target on bid buttons (mobile).
// — Illegal actions: opacity 0.3 + pointer-events-none (NOT just visual).
// — No `plate` wrapper decoration — the panel sits flat on the battlefield bg.
// — Pass = ghost (ash), C/D/H/S/NT/AT = cream tiles, Contra/Recontra = ember.

const ORDER: BidContract[] = ['C', 'D', 'H', 'S', 'NT', 'AT']
const SUIT_GLYPH: Record<BidContract, string> = { C: '♣', D: '♦', H: '♥', S: '♠', NT: '∅', AT: '⁂' }
const SUIT_RED: Record<BidContract, boolean> = { C: false, D: true, H: true, S: false, NT: false, AT: false }

export function BiddingPanel() {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const mySeat = useGame((s) => s.mySeat)
  const send = useGame((s) => s.send)
  const myTurn = view.turn === mySeat
  const turnHolderName = room.seats[view.turn]?.nickname ?? '—'

  // Last BID in history pins the floor — anything ≤ that index is illegal.
  const currentBidIdx = (() => {
    for (let i = view.bidHistory.length - 1; i >= 0; i--) {
      const h = view.bidHistory[i]
      if (h && h.type === 'BID') return ORDER.indexOf(h.contract)
    }
    return -1
  })()

  // Contra is only legal when the OPPONENTS hold the current bid and no contra yet.
  const lastBid = (() => {
    for (let i = view.bidHistory.length - 1; i >= 0; i--) {
      const h = view.bidHistory[i]
      if (h && h.type === 'BID') return h
    }
    return null
  })()
  const myTeam = mySeat !== null && (mySeat === 0 || mySeat === 2) ? 'NS' : 'EW'
  const lastBidTeam = lastBid ? (lastBid.seat === 0 || lastBid.seat === 2 ? 'NS' : 'EW') : null
  const hasContra = view.multiplier >= 2
  const hasRecontra = view.multiplier >= 4
  const canContra = !!lastBid && lastBidTeam !== myTeam && !hasContra
  const canRecontra = !!lastBid && lastBidTeam === myTeam && hasContra && !hasRecontra

  // Idle (not my turn) — minimal label only, no decoration.
  if (!myTurn) {
    return (
      <div className="text-center py-2">
        <div className="eyebrow">{t('table.bidding')}</div>
        <div className="font-display italic text-cream/80 mt-1 text-sm sm:text-base">
          {t('bid.waitFor', { name: turnHolderName })}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="w-full max-w-[560px] mx-auto"
    >
      {/* Header — your turn + PASS as quick-exit */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="eyebrow eyebrow-active">{t('bid.yourTurn')}</div>
        <button
          onClick={() => void send({ type: 'PASS', seat: mySeat! })}
          className="font-mono text-[11px] tracking-[0.22em] uppercase text-ash hover:text-cream active:text-brass-hi transition px-3 py-2 border border-ash/30 hover:border-ash/60 rounded"
        >
          {t('bid.pass')}
        </button>
      </div>

      {/* Bid grid — 6 contracts in 2 rows. Min 44px tap height enforced via py + min-h. */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
        {ORDER.map((c, i) => {
          const disabled = i <= currentBidIdx
          return (
            <BidTile
              key={c}
              contract={c}
              disabled={disabled}
              onClick={() => void send({ type: 'BID', seat: mySeat!, contract: c })}
              label={t(`suit.${c}.name` as `suit.${BidContract}.name`)}
            />
          )
        })}
      </div>

      {/* Contra / Recontra — only legal when applicable (per spec, illegal = pointer-events-none) */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <button
          onClick={() => void send({ type: 'CONTRA', seat: mySeat! })}
          disabled={!canContra}
          className="btn-ember w-full"
        >
          {t('bid.contra')}
        </button>
        <button
          onClick={() => void send({ type: 'RECONTRA', seat: mySeat! })}
          disabled={!canRecontra}
          className="btn-ember w-full"
        >
          {t('bid.recontra')}
        </button>
      </div>
    </motion.div>
  )
}

function BidTile({
  contract,
  disabled,
  onClick,
  label,
}: {
  contract: BidContract
  disabled: boolean
  onClick: () => void
  label: string
}) {
  const red = SUIT_RED[contract]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative min-h-[60px] sm:min-h-[78px] flex flex-col items-center justify-center rounded transition-all duration-150 ${
        disabled
          ? 'opacity-30 pointer-events-none bg-paper/40 border border-ash/20'
          : 'plate-cream hover:brightness-105 active:scale-[0.97] cursor-pointer'
      }`}
      style={{ transitionDuration: disabled ? '0ms' : '150ms' }}
    >
      <span
        className={`font-display text-3xl sm:text-4xl leading-none ${
          red ? 'text-ember' : 'text-stone-900'
        }`}
        aria-hidden
      >
        {SUIT_GLYPH[contract]}
      </span>
      <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.18em] uppercase text-stone-700 mt-1.5">
        {label}
      </span>
    </button>
  )
}
