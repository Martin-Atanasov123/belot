import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'
import { CardView } from './Card.js'
import { BiddingPanel } from './BiddingPanel.js'
import { CornerOrnament, Monogram } from './Ornaments.js'
import { LanguageToggle } from './LanguageToggle.js'
import type { Card, Seat } from '@belot/shared'
import type { MessageKey } from '../i18n/bg.js'

const SUIT_GLYPH: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const CONTRACT_GLYPH: Record<string, { glyph: string; red: boolean }> = {
  C:  { glyph: '♣', red: false },
  D:  { glyph: '♦', red: true  },
  H:  { glyph: '♥', red: true  },
  S:  { glyph: '♠', red: false },
  NT: { glyph: '∅', red: false },
  AT: { glyph: '⁂', red: false },
}

type Pos = 'bottom' | 'left' | 'top' | 'right'

// Compact viewport hook — picks layout densities for the play zone.
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

// Card landing offsets within the felt circle. Mobile uses a tighter radius.
function playOffset(pos: Pos, mobile: boolean): { x: number; y: number; rot: number } {
  const r = mobile ? 34 : 48
  switch (pos) {
    case 'bottom': return { x:  0, y:  r, rot:   2 }
    case 'top':    return { x:  0, y: -r, rot: 182 }
    case 'left':   return { x: -r, y:  0, rot: -10 }
    case 'right':  return { x:  r, y:  0, rot:  10 }
  }
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

  // ── Seat badge — compact on mobile, full on desktop. ─────────────────────
  const SeatBadge = ({ pos, compact = false }: { pos: Pos; compact?: boolean }) => {
    const seat = seatByPos[pos]
    const occ = room.seats[seat]
    const isActive = view.turn === seat && (inBidding || inPlay)
    const size = compact ? 'px-2 py-1 min-w-[80px]' : 'px-3 py-2 min-w-[100px] sm:min-w-[120px]'
    return (
      <motion.div
        layout
        className={`relative plate ${size} inline-flex flex-col items-center gap-0.5 ${
          isActive ? 'seat-active' : ''
        }`}
      >
        <div className={`eyebrow text-ash ${compact ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'}`}>
          {t('lobby.seat')} {seat + 1}
        </div>
        <div className={`font-display text-cream leading-tight truncate ${
          compact ? 'text-xs max-w-[80px]' : 'text-sm sm:text-base max-w-[110px] sm:max-w-[150px]'
        }`}>
          {occ?.nickname ?? '—'}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
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
      </motion.div>
    )
  }

  const contract = view.contract
    ? { ...CONTRACT_GLYPH[view.contract], name: t(`suit.${view.contract}.name` as MessageKey) }
    : null
  const turnHolderName = room.seats[view.turn]?.nickname ?? '—'

  return (
    <div className="min-h-[100dvh] bg-ink relative overflow-hidden flex flex-col no-select">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise" />

      {/* Corner ornaments — smaller on mobile to save room */}
      <CornerOrnament className="absolute top-2 left-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" />
      <CornerOrnament className="absolute top-2 right-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-2 left-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" style={{ transform: 'scaleY(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-2 right-2 w-7 h-7 sm:w-10 sm:h-10 text-brass/30 z-10" style={{ transform: 'scale(-1,-1)' } as React.CSSProperties} />

      {/* ── Top bar ── */}
      <header className="relative z-20 border-b border-brass/20 bg-ink/40 backdrop-blur-sm">
        {/* Row 1: monogram + room + score + lang */}
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

        {/* Row 2 (mobile only): hand # + contract chip */}
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

        {/* Desktop contract chip in row 1 area */}
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

      {/* ── Felt area: top seat / [left+felt+right] / bottom hand+seat ── */}
      <div className="relative z-10 flex-1 grid grid-rows-[auto_1fr_auto] gap-1 sm:gap-2 px-2 sm:px-4 pt-2 pb-1 sm:pb-3">
        {/* Top seat */}
        <div className="flex justify-center">
          <SeatBadge pos="top" compact={isMobile} />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 sm:gap-3">
          <div className="flex justify-start">
            <SeatBadge pos="left" compact={isMobile} />
          </div>
          <PlayZone trickPlays={trickPlays} turnHolderName={turnHolderName} isMobile={isMobile} />
          <div className="flex justify-end">
            <SeatBadge pos="right" compact={isMobile} />
          </div>
        </div>

        {/* Bottom: bidding panel + your hand + your badge */}
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-display italic text-brass text-sm sm:text-lg"
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

// ── Central play zone ───────────────────────────────────────────────────
function PlayZone({
  trickPlays,
  turnHolderName,
  isMobile,
}: {
  trickPlays: Array<{ seat: Seat; card: Card; order: number; pos: Pos }>
  turnHolderName: string
  isMobile: boolean
}) {
  const t = useT()
  const view = useGame((s) => s.view)!
  const inAction = view.phase === 'PLAYING' || view.phase === 'BIDDING'

  const offscreen = (pos: Pos) => {
    const big = isMobile ? 100 : 140
    switch (pos) {
      case 'bottom': return { x: 0, y: big, rot: 0 }
      case 'top':    return { x: 0, y: -big, rot: 180 }
      case 'left':   return { x: -big, y: 0, rot: -15 }
      case 'right':  return { x: big, y: 0, rot: 15 }
    }
  }

  const feltSize = isMobile ? 180 : 240
  const monoSize = isMobile ? 50 : 70

  return (
    <div className={`flex items-center justify-center ${isMobile ? 'min-h-[220px]' : 'min-h-[280px] md:min-h-[320px]'}`}>
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
              const from = offscreen(p.pos)
              return (
                <motion.div
                  key={`${p.seat}:${p.card.suit}${p.card.rank}`}
                  initial={{ opacity: 0, x: from.x, y: from.y, rotate: from.rot, scale: 0.85 }}
                  animate={{ opacity: 1, x: dest.x, y: dest.y, rotate: dest.rot, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
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

        {/* Idle overlay */}
        {trickPlays.length === 0 && inAction && view.phase !== 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <div className="eyebrow text-ash text-[9px] sm:text-[10px]">
              {view.phase === 'BIDDING' ? t('table.bidding') : t('table.yourTurn').replace(/—/g, '').trim()}
            </div>
            <div className="font-display italic text-cream/80 mt-1 text-xs sm:text-sm max-w-[160px] sm:max-w-[200px] truncate">
              {view.phase === 'BIDDING'
                ? t('bid.waitFor', { n: view.turn + 1 })
                : turnHolderName}
            </div>
          </div>
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

        {/* Last-trick caption */}
        {trickPlays.length === 0 && view.lastTrick && view.phase === 'PLAYING' && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-display italic text-cream/55 text-[10px] sm:text-xs">
            {t('table.lastTrick', { n: view.lastTrick.winner + 1 })}
          </div>
        )}

        {/* Announcements */}
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
