import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'
import { CardView } from './Card.js'
import { BiddingPanel } from './BiddingPanel.js'
import { CornerOrnament, Monogram } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'
import type { BidContract, BidHistoryEntry, Card, Seat } from '@belot/shared'
import type { MessageKey } from '../i18n/bg.js'

const SUIT_GLYPH: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const CONTRACT_GLYPH: Record<BidContract, { glyph: string; red: boolean }> = {
  C:  { glyph: '♣', red: false },
  D:  { glyph: '♦', red: true  },
  H:  { glyph: '♥', red: true  },
  S:  { glyph: '♠', red: false },
  NT: { glyph: '∅', red: false },
  AT: { glyph: '⁂', red: false },
}

type Pos = 'bottom' | 'left' | 'top' | 'right'

function useIsMobile() {
  const [isMobile, set] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const fn = (e: MediaQueryListEvent) => set(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isMobile
}

function playOffset(pos: Pos, mobile: boolean): { x: number; y: number; rot: number } {
  const r = mobile ? 34 : 48
  switch (pos) {
    case 'bottom': return { x:  0, y:  r, rot:   2 }
    case 'top':    return { x:  0, y: -r, rot: 182 }
    case 'left':   return { x: -r, y:  0, rot: -10 }
    case 'right':  return { x:  r, y:  0, rot:  10 }
  }
}

// Off-the-felt landing point used both for incoming slide-in and for the
// "collected by the winner" slide-out.
function offFelt(pos: Pos, mobile: boolean): { x: number; y: number } {
  const big = mobile ? 110 : 150
  switch (pos) {
    case 'bottom': return { x: 0,    y:  big }
    case 'top':    return { x: 0,    y: -big }
    case 'left':   return { x: -big, y:    0 }
    case 'right':  return { x:  big, y:    0 }
  }
}

// Last action per seat from the bid history (used during BIDDING to show what each player said).
type SeatBidAction =
  | { type: 'BID'; contract: BidContract }
  | { type: 'PASS' }
  | { type: 'CONTRA' }
  | { type: 'RECONTRA' }
  | null

function lastActionsPerSeat(history: BidHistoryEntry[]): Record<Seat, SeatBidAction> {
  const out: Record<Seat, SeatBidAction> = { 0: null, 1: null, 2: null, 3: null }
  for (const h of history) {
    const s = h.seat as Seat
    if (h.type === 'BID') out[s] = { type: 'BID', contract: h.contract }
    else if (h.type === 'PASS') out[s] = { type: 'PASS' }
    else if (h.type === 'CONTRA') out[s] = { type: 'CONTRA' }
    else if (h.type === 'RECONTRA') out[s] = { type: 'RECONTRA' }
  }
  return out
}

function lastBidEntry(history: BidHistoryEntry[]):
  | { type: 'BID'; seat: Seat; contract: BidContract }
  | null
{
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!
    if (h.type === 'BID') return { type: 'BID', seat: h.seat as Seat, contract: h.contract }
  }
  return null
}

export function Table() {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const mySeat = useGame((s) => s.mySeat)!
  const send = useGame((s) => s.send)
  const isMobile = useIsMobile()

  const visualSeat = (seat: Seat): Pos => {
    const rel = (seat - mySeat + 4) % 4
    return (['bottom', 'left', 'top', 'right'] as const)[rel]!
  }

  const seatByPos = useMemo(() => {
    const m: Record<Pos, Seat> = { bottom: 0, left: 1, top: 2, right: 3 }
    for (const s of [0, 1, 2, 3] as Seat[]) m[visualSeat(s)] = s
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySeat])

  const trickPlays = (view.currentTrick?.cards ?? []).map((p, idx) => ({
    seat: p.seat as Seat,
    card: p.card,
    order: idx,
    pos: visualSeat(p.seat as Seat),
  }))

  const isMyTurn = view.turn === mySeat
  const inBidding = view.phase === 'BIDDING'
  const inPlay = view.phase === 'PLAYING'

  const onPlay = (card: Card) => {
    void send({ type: 'PLAY', seat: mySeat, card })
  }

  // While 4 cards sit on the felt, `view.turn` already points at the winner-elect
  // (set by the engine when the trick becomes complete). We use that as the
  // collection target so the exit animation slides the cards toward them.
  const collectionWinnerPos: Pos | null =
    trickPlays.length === 4 ? visualSeat(view.turn) : null

  const actionsBySeat = useMemo(
    () => lastActionsPerSeat(view.bidHistory),
    [view.bidHistory],
  )
  const liveBid = lastBidEntry(view.bidHistory)

  // ── Seat badge — name + small status (no "Място N" anymore) ──────────────
  const SeatBadge = ({ pos, compact = false }: { pos: Pos; compact?: boolean }) => {
    const seat = seatByPos[pos]
    const occ = room.seats[seat]
    const isActive = view.turn === seat && (inBidding || inPlay)
    const myBadge = seat === mySeat
    const size = compact ? 'px-2 py-1 min-w-[90px]' : 'px-3 py-2 min-w-[110px] sm:min-w-[130px]'
    const lastAct = inBidding ? actionsBySeat[seat] : null

    return (
      <motion.div
        layout
        className={`relative plate ${size} inline-flex flex-col items-center gap-0.5 ${
          isActive ? 'seat-active' : ''
        }`}
        {...(isActive ? { style: { borderColor: 'rgba(230,193,120,0.85)' } } : {})}
      >
        <div className={`font-display text-cream leading-tight truncate ${
          compact ? 'text-sm max-w-[100px]' : 'text-base sm:text-lg max-w-[140px] sm:max-w-[170px]'
        } ${myBadge ? 'text-brass-hi' : ''}`}>
          {occ?.nickname ?? '—'}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`font-mono text-brass tracking-[0.14em] ${compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
            {view.handCounts[seat]} {t('table.cards')}
          </span>
          {occ?.isBot && (
            <span className={`font-mono text-brass-hi tracking-[0.14em] ${compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
              {t('common.bot')}
            </span>
          )}
          {occ && !occ.connected && !occ.isBot && (
            <span className={`font-mono text-ember-hi tracking-[0.14em] ${compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
              {t('common.offline')}
            </span>
          )}
        </div>

        {/* Bidding bubble — sits above the badge, points at it */}
        {lastAct && (
          <AnimatePresence>
            <motion.div
              key={`${seat}-${describeAction(lastAct)}`}
              initial={{ opacity: 0, y: 4, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="absolute -top-7 left-1/2 -translate-x-1/2"
            >
              <BidBubble action={lastAct} compact={compact} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* "На ход" chevron — points back at the badge from the felt side */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 font-mono text-brass-hi text-base leading-none drop-shadow-[0_0_8px_rgba(230,193,120,0.8)]"
            style={pos === 'top' ? { bottom: -14 } : { top: -14 }}
          >
            {pos === 'top' ? '▾' : '▴'}
          </motion.div>
        )}
      </motion.div>
    )
  }

  const contract = view.contract
    ? { ...CONTRACT_GLYPH[view.contract], name: t(`suit.${view.contract}.name` as MessageKey) }
    : null

  return (
    <div className="min-h-[100dvh] bg-ink relative overflow-hidden flex flex-col no-select">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise" />

      <CornerOrnament className="absolute top-2 left-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" />
      <CornerOrnament className="absolute top-2 right-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-2 left-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" style={{ transform: 'scaleY(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-2 right-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" style={{ transform: 'scale(-1,-1)' } as React.CSSProperties} />

      {/* Top bar */}
      <header className="relative z-20 border-b border-brass/20 bg-ink/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Monogram size={isMobile ? 22 : 28} />
            <div className="min-w-0">
              <div className="eyebrow text-ash leading-none text-[9px] sm:text-[10px]">{t('table.room')}</div>
              <div className="font-mono text-brass tracking-[0.22em] sm:tracking-[0.28em] text-xs sm:text-sm">{room.code}</div>
            </div>
            <div className="hidden md:block ml-2">
              <div className="eyebrow text-ash leading-none">{t('table.handLabel')}</div>
              <div className="font-display italic text-cream text-sm">{t('table.handNo', { n: view.handNo })}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="plate px-2 sm:px-3 py-1 flex items-center gap-2 sm:gap-3 font-mono text-xs sm:text-sm">
              <div className="text-center leading-none">
                <div className="eyebrow text-ash text-[8px] sm:text-[10px]">NS</div>
                <div className="text-cream text-sm sm:text-base">{view.matchScore.NS}</div>
              </div>
              <div className="w-px h-5 sm:h-7 bg-brass/30" />
              <div className="text-center leading-none">
                <div className="eyebrow text-ash text-[8px] sm:text-[10px]">EW</div>
                <div className="text-cream text-sm sm:text-base">{view.matchScore.EW}</div>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </div>

        {/* Mobile row 2 */}
        <div className="md:hidden flex items-center justify-between px-2 pb-1.5 gap-2 text-xs">
          <div className="font-display italic text-cream/80">
            {t('table.handLabel')} {t('table.handNo', { n: view.handNo })}
          </div>
          {contract ? (
            <div className="chip py-0.5 text-[10px]">
              <span className={`text-sm leading-none ${contract.red ? 'text-ember-hi' : 'text-brass-hi'}`}>{contract.glyph}</span>
              <span>{contract.name}</span>
              {view.multiplier > 1 && <span className="text-ember-hi">×{view.multiplier}</span>}
            </div>
          ) : (
            <div className="chip py-0.5 text-[10px]">{t('table.bidding')}</div>
          )}
        </div>

        {/* Desktop contract chip on row 1 */}
        <div className="hidden md:flex absolute right-44 top-1/2 -translate-y-1/2">
          {contract ? (
            <div className="chip">
              <span className={`text-base leading-none ${contract.red ? 'text-ember-hi' : 'text-brass-hi'}`}>{contract.glyph}</span>
              <span>{contract.name}</span>
              {view.multiplier > 1 && <span className="text-ember-hi">×{view.multiplier}</span>}
            </div>
          ) : (
            <div className="chip">{t('table.bidding')}</div>
          )}
        </div>
      </header>

      {/* Felt area */}
      <div className="relative z-10 flex-1 grid grid-rows-[auto_1fr_auto] gap-1 sm:gap-2 px-2 sm:px-4 pt-3 pb-1 sm:pb-3">
        <div className="flex justify-center">
          <SeatBadge pos="top" compact={isMobile} />
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 sm:gap-3">
          <div className="flex justify-start">
            <SeatBadge pos="left" compact={isMobile} />
          </div>
          <PlayZone
            trickPlays={trickPlays}
            isMobile={isMobile}
            collectionWinnerPos={collectionWinnerPos}
            liveBid={liveBid}
          />
          <div className="flex justify-end">
            <SeatBadge pos="right" compact={isMobile} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 sm:gap-3">
          {inBidding && <BiddingPanel />}

          <div
            className="hand-scroll flex justify-center items-end overflow-x-auto max-w-full px-1"
            style={{ paddingTop: 10 }}
          >
            {view.yourHand.map((c, i) => {
              const total = view.yourHand.length
              const fanCenter = (total - 1) / 2
              const offset = i - fanCenter
              const tilt = (isMobile ? 2.4 : 3.2) * offset
              const lift = Math.abs(offset) * (isMobile ? 1 : 2)
              const overlap = isMobile ? -14 : -18
              return (
                <motion.div
                  key={`${c.suit}${c.rank}-${i}`}
                  initial={{ opacity: 0, y: 36, rotate: tilt - 8 }}
                  animate={{ opacity: 1, y: lift, rotate: tilt }}
                  transition={{ delay: 0.04 * i, type: 'spring', stiffness: 220, damping: 24 }}
                  {...(inPlay && isMyTurn ? { whileHover: { y: lift - 14 } } : {})}
                  style={{ marginLeft: i === 0 ? 0 : overlap, zIndex: i }}
                >
                  <CardView
                    card={c}
                    onClick={() => onPlay(c)}
                    disabled={!(inPlay && isMyTurn)}
                  />
                </motion.div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <SeatBadge pos="bottom" compact={isMobile} />
            {isMyTurn && (inBidding || inPlay) && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-display italic text-brass-hi text-sm sm:text-lg"
              >
                {t('table.yourTurn')}
              </motion.span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Bidding bubble (per-seat last action) ──────────────────────────────
function BidBubble({ action, compact }: { action: SeatBidAction; compact: boolean }) {
  if (!action) return null
  const base = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
    compact ? 'text-[10px]' : 'text-xs'
  } font-mono tracking-[0.14em] whitespace-nowrap`

  if (action.type === 'PASS') {
    return (
      <div className={`${base} bg-stone-900/60 border-stone-500/40 text-stone-300`}>
        ПАС
      </div>
    )
  }
  if (action.type === 'CONTRA' || action.type === 'RECONTRA') {
    return (
      <div className={`${base} bg-ember/30 border-ember-hi/60 text-ember-hi uppercase`}>
        {action.type === 'CONTRA' ? 'Контра' : 'Реконтра'}
      </div>
    )
  }
  const g = CONTRACT_GLYPH[action.contract]
  const extraLabel = action.contract === 'NT' ? 'NT' : action.contract === 'AT' ? 'AT' : null
  return (
    <div className={`${base} bg-cream/95 border-brass-hi text-stone-900`}>
      <span className={`text-sm leading-none ${g.red ? 'text-ember' : 'text-stone-900'}`}>{g.glyph}</span>
      {extraLabel && <span>{extraLabel}</span>}
    </div>
  )
}

function describeAction(a: SeatBidAction): string {
  if (!a) return ''
  if (a.type === 'BID') return `b:${a.contract}`
  return a.type.toLowerCase()
}

// ── Central play zone ──────────────────────────────────────────────────
function PlayZone({
  trickPlays,
  isMobile,
  collectionWinnerPos,
  liveBid,
}: {
  trickPlays: Array<{ seat: Seat; card: Card; order: number; pos: Pos }>
  isMobile: boolean
  collectionWinnerPos: Pos | null
  liveBid: { type: 'BID'; seat: Seat; contract: BidContract } | null
}) {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const inBidding = view.phase === 'BIDDING'
  const inPlay = view.phase === 'PLAYING'

  const offscreenEntry = (pos: Pos) => {
    const o = offFelt(pos, isMobile)
    const rot = pos === 'top' ? 180 : pos === 'left' ? -15 : pos === 'right' ? 15 : 0
    return { x: o.x, y: o.y, rot }
  }

  // When `collectionWinnerPos` is set (4 cards on the table waiting to resolve),
  // each card's exit prop slides it toward the winner's edge.
  const exitFor = (cardPos: Pos) => {
    if (collectionWinnerPos) {
      const o = offFelt(collectionWinnerPos, isMobile)
      const rotate = collectionWinnerPos === 'top' ? 180 : 0
      return {
        x: o.x * 0.7,
        y: o.y * 0.7,
        scale: 0.5,
        rotate,
        opacity: 0,
        transition: { duration: 0.55, ease: [0.55, 0.06, 0.68, 0.19] as const },
      }
    }
    // Fallback: same direction it came from
    const o = offFelt(cardPos, isMobile)
    return { x: o.x * 0.5, y: o.y * 0.5, scale: 0.7, opacity: 0, transition: { duration: 0.3 } }
  }

  const feltSize = isMobile ? 180 : 240
  const monoSize = isMobile ? 50 : 70

  // Whose turn is it (visible during BIDDING / PLAYING) — name only.
  const turnHolderName = room.seats[view.turn]?.nickname ?? '—'
  const liveBidName = liveBid ? room.seats[liveBid.seat]?.nickname ?? '—' : null

  return (
    <div className={`flex items-center justify-center ${isMobile ? 'min-h-[230px]' : 'min-h-[300px] md:min-h-[330px]'}`}>
      <div className="relative">
        {/* Felt circle */}
        <div
          className="rounded-full border border-brass/25 shadow-[inset_0_0_60px_rgba(0,0,0,0.55)]"
          style={{
            width: feltSize,
            height: feltSize,
            background:
              'radial-gradient(circle at 50% 40%, rgba(28,82,64,.9), rgba(14,37,28,.95) 70%, rgba(7,18,14,1) 100%)',
          }}
        >
          <div className="absolute inset-2 sm:inset-3 rounded-full border border-brass/15" />
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <Monogram size={monoSize} />
          </div>
        </div>

        {/* Played cards */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence>
            {trickPlays.map((p) => {
              const dest = playOffset(p.pos, isMobile)
              const from = offscreenEntry(p.pos)
              return (
                <motion.div
                  key={`${p.seat}:${p.card.suit}${p.card.rank}`}
                  initial={{ opacity: 0, x: from.x, y: from.y, rotate: from.rot, scale: 0.85 }}
                  animate={{ opacity: 1, x: dest.x, y: dest.y, rotate: dest.rot, scale: 1 }}
                  exit={exitFor(p.pos)}
                  transition={{ type: 'spring', stiffness: 240, damping: 22 }}
                  style={{ position: 'absolute', zIndex: 10 + p.order, pointerEvents: 'none' }}
                >
                  <CardView card={p.card} disabled />
                  <SeatTag pos={p.pos} />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Idle / turn indicator overlay */}
        {trickPlays.length === 0 && view.phase !== 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
            {inBidding ? (
              <BiddingCenterPanel liveBid={liveBid} liveBidName={liveBidName} turnHolderName={turnHolderName} />
            ) : inPlay ? (
              <div>
                <div className="eyebrow text-ash text-[9px] sm:text-[10px]">{t('table.onTurn')}</div>
                <div className="font-display italic text-cream text-base sm:text-xl mt-1 truncate max-w-[150px] sm:max-w-[200px]">
                  {turnHolderName}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Mid-play "waiting for X" — shown when trick has 1..3 cards (in tens etc.) */}
        {inPlay && trickPlays.length > 0 && trickPlays.length < 4 && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] sm:text-xs tracking-[0.18em] text-brass uppercase">
            ↻ {t('table.waitingFor')} {turnHolderName}
          </div>
        )}

        {/* Brief "collected by X" overlay during the 0.55s slide-to-winner */}
        {trickPlays.length === 0 && view.lastTrick && view.phase === 'PLAYING' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-display italic text-cream/70 text-[11px] sm:text-xs"
          >
            ▸ {t('table.collected')} {room.seats[view.lastTrick.winner]?.nickname ?? '—'}
          </motion.div>
        )}

        {/* Game over */}
        {view.phase === 'GAME_OVER' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="plate px-4 sm:px-6 py-3 sm:py-4 text-center"
            >
              <div className="eyebrow text-brass mb-1 text-[9px] sm:text-[10px]">{t('table.gameOver')}</div>
              <div className="font-display text-cream text-xl sm:text-2xl">
                {view.matchScore.NS > view.matchScore.EW ? t('table.teamNS') : t('table.teamEW')}
              </div>
              <div className="font-mono text-brass-hi mt-1 tracking-widest text-xs sm:text-sm">
                {view.matchScore.NS} : {view.matchScore.EW}
              </div>
            </motion.div>
          </div>
        )}

        {/* Announcements ribbon */}
        {view.announcements.length > 0 && view.phase !== 'GAME_OVER' && (
          <div className="absolute -top-8 sm:-top-9 left-1/2 -translate-x-1/2 flex flex-wrap gap-1 justify-center max-w-[260px] sm:max-w-[320px]">
            {view.announcements.slice(0, 3).map((a, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="chip text-[9px] sm:text-[10px] py-0.5"
              >
                {a.kind === 'sequence' && (
                  <>
                    {t('table.seqOf', { n: a.length, suit: SUIT_GLYPH[a.suit] ?? a.suit })}
                    {' · '}
                    <span className="text-brass-hi">+{a.points}</span>
                  </>
                )}
                {a.kind === 'carre' && (
                  <>
                    {t('table.carre', { rank: a.rank })} · <span className="text-brass-hi">+{a.points}</span>
                  </>
                )}
                {a.kind === 'belot' && <>{t('table.belot')} · <span className="text-brass-hi">+20</span></>}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Center info shown during BIDDING: live highest bid + whose turn it is.
function BiddingCenterPanel({
  liveBid,
  liveBidName,
  turnHolderName,
}: {
  liveBid: { type: 'BID'; seat: Seat; contract: BidContract } | null
  liveBidName: string | null
  turnHolderName: string
}) {
  const t = useT()
  const view = useGame((s) => s.view)!

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="eyebrow text-ash text-[9px] sm:text-[10px]">{t('bid.lastBidLabel')}</div>

      {liveBid ? (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`font-display text-lg sm:text-2xl leading-none ${CONTRACT_GLYPH[liveBid.contract].red ? 'text-ember-hi' : 'text-brass-hi'}`}>
            {CONTRACT_GLYPH[liveBid.contract].glyph}
          </span>
          <span className="font-display italic text-cream/90 text-sm sm:text-base whitespace-nowrap">
            {t(`suit.${liveBid.contract}.name` as MessageKey)} · {liveBidName}
          </span>
          {view.multiplier > 1 && (
            <span className="font-mono text-[10px] tracking-widest text-ember-hi">×{view.multiplier}</span>
          )}
        </div>
      ) : (
        <div className="font-display italic text-cream/60 text-sm mt-0.5">{t('bid.noBidYet')}</div>
      )}

      <div className="mt-1.5 flex flex-col items-center">
        <div className="eyebrow text-brass text-[8px] sm:text-[10px]">{t('table.onTurn')}</div>
        <div className="font-display italic text-cream text-base sm:text-lg truncate max-w-[150px] sm:max-w-[200px]">
          {turnHolderName}
        </div>
      </div>
    </div>
  )
}

function SeatTag({ pos }: { pos: Pos }) {
  const anchor: Record<Pos, React.CSSProperties> = {
    bottom: { left: '50%', bottom: -12, transform: 'translateX(-50%)' },
    top:    { left: '50%', top:    -12, transform: 'translateX(-50%) rotate(180deg)' },
    left:   { top:  '50%', left:   -18, transform: 'translateY(-50%)' },
    right:  { top:  '50%', right:  -18, transform: 'translateY(-50%)' },
  }
  return (
    <span
      aria-hidden
      className="absolute font-mono text-[9px] tracking-[0.18em] text-brass-hi/80"
      style={anchor[pos]}
    >
      ▸
    </span>
  )
}
