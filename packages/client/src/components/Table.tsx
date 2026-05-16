import { useMemo } from 'react'
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

// Where each played card sits inside the central play-zone, and how it rotates.
// Coords are pixels from the center of the zone. A bit of overlap is intentional —
// cards funnel toward the middle but stay clearly attributable to a player.
const PLAY_OFFSET: Record<Pos, { x: number; y: number; rot: number }> = {
  bottom: { x:   0, y:  44, rot:   2 },
  left:   { x: -54, y:   0, rot: -10 },
  top:    { x:   0, y: -44, rot: 182 },
  right:  { x:  54, y:   0, rot:  10 },
}

export function Table() {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const mySeat = useGame((s) => s.mySeat)!
  const send = useGame((s) => s.send)

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

  // Order trick cards by their play order so newer cards stack on top.
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

  const SeatBadge = ({ pos }: { pos: Pos }) => {
    const seat = seatByPos[pos]
    const occ = room.seats[seat]
    const isActive = view.turn === seat && (inBidding || inPlay)
    return (
      <motion.div
        layout
        className={`relative plate px-4 py-2 inline-flex flex-col items-center gap-0.5 min-w-[120px] ${
          isActive ? 'seat-active' : ''
        }`}
      >
        <div className="eyebrow text-ash">{t('lobby.seat')} {seat + 1}</div>
        <div className="font-display text-cream text-base leading-tight truncate max-w-[160px]">
          {occ?.nickname ?? '—'}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-mono text-[10px] text-brass tracking-[0.18em]">
            {view.handCounts[seat]} {t('table.cards')}
          </span>
          {occ?.isBot && (
            <span className="font-mono text-[10px] text-brass-hi tracking-[0.18em]">{t('common.bot')}</span>
          )}
          {occ && !occ.connected && !occ.isBot && (
            <span className="font-mono text-[10px] text-ember-hi tracking-[0.18em]">{t('common.offline')}</span>
          )}
        </div>
      </motion.div>
    )
  }

  const contract = view.contract
    ? { ...CONTRACT_GLYPH[view.contract], name: t(`suit.${view.contract}.name` as MessageKey) }
    : null

  // Header chip describing whose turn it is — text + arrow toward their seat
  const turnHolderName = room.seats[view.turn]?.nickname ?? '—'

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden flex flex-col no-select">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise" />

      <CornerOrnament className="absolute top-3 left-3 w-10 h-10 text-brass/30 z-10" />
      <CornerOrnament className="absolute top-3 right-3 w-10 h-10 text-brass/30 z-10" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-3 left-3 w-10 h-10 text-brass/30 z-10" style={{ transform: 'scaleY(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-3 right-3 w-10 h-10 text-brass/30 z-10" style={{ transform: 'scale(-1,-1)' } as React.CSSProperties} />

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-4 py-2 border-b border-brass/20 bg-ink/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Monogram size={28} />
          <div>
            <div className="eyebrow text-ash leading-none">{t('table.room')}</div>
            <div className="font-mono text-brass tracking-[0.28em] text-sm">{room.code}</div>
          </div>
          <div className="ml-4 hidden md:block">
            <div className="eyebrow text-ash leading-none">{t('table.handLabel')}</div>
            <div className="font-display italic text-cream">{t('table.handNo', { n: view.handNo })}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {contract ? (
            <div className="chip">
              <span className={`text-base leading-none ${contract.red ? 'text-ember-hi' : 'text-brass-hi'}`}>{contract.glyph}</span>
              <span>{contract.name}</span>
              {view.multiplier > 1 && <span className="text-ember-hi">×{view.multiplier}</span>}
            </div>
          ) : (
            <div className="chip">{t('table.bidding')}</div>
          )}
          <div className="plate px-4 py-1 flex items-center gap-3 font-mono text-sm">
            <div className="text-center">
              <div className="eyebrow text-ash leading-none">NS</div>
              <div className="text-cream text-base">{view.matchScore.NS}</div>
            </div>
            <div className="w-px h-7 bg-brass/30" />
            <div className="text-center">
              <div className="eyebrow text-ash leading-none">EW</div>
              <div className="text-cream text-base">{view.matchScore.EW}</div>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Felt area with seat badges around a central play-zone */}
      <div className="relative z-10 flex-1 grid grid-rows-[auto_1fr_auto] gap-2 p-4">
        {/* Top seat */}
        <div className="flex justify-center">
          <SeatBadge pos="top" />
        </div>

        {/* Middle row: left badge, play-zone, right badge */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex justify-start"><SeatBadge pos="left" /></div>

          <PlayZone trickPlays={trickPlays} turnHolderName={turnHolderName} />

          <div className="flex justify-end"><SeatBadge pos="right" /></div>
        </div>

        {/* Bottom: bidding panel + your hand + your badge */}
        <div className="flex flex-col items-center gap-3">
          {inBidding && <BiddingPanel />}

          <div
            className="hand-scroll flex justify-center items-end overflow-x-auto max-w-full px-2"
            style={{ paddingTop: 14 }}
          >
            {view.yourHand.map((c, i) => {
              const total = view.yourHand.length
              const fanCenter = (total - 1) / 2
              const offset = i - fanCenter
              const tilt = offset * 3.2
              const lift = Math.abs(offset) * 2 // outer cards sit a hair lower so the fan curves
              return (
                <motion.div
                  key={`${c.suit}${c.rank}-${i}`}
                  initial={{ opacity: 0, y: 36, rotate: tilt - 8 }}
                  animate={{ opacity: 1, y: lift, rotate: tilt }}
                  transition={{ delay: 0.04 * i, type: 'spring', stiffness: 220, damping: 24 }}
                  {...(inPlay && isMyTurn ? { whileHover: { y: lift - 16 } } : {})}
                  style={{ marginLeft: i === 0 ? 0 : -18, zIndex: i }}
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

          <div className="flex items-center gap-3">
            <SeatBadge pos="bottom" />
            {isMyTurn && (inBidding || inPlay) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-display italic text-brass text-lg"
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

// ────────────────────────── Central play zone ──────────────────────────
// A round felt patch where cards land. Each card slides in FROM the player's
// direction toward the center, settles offset toward its source, and rotates
// slightly so it's visually obvious who played what.
function PlayZone({
  trickPlays,
  turnHolderName,
}: {
  trickPlays: Array<{ seat: Seat; card: Card; order: number; pos: Pos }>
  turnHolderName: string
}) {
  const t = useT()
  const view = useGame((s) => s.view)!
  const inAction = view.phase === 'PLAYING' || view.phase === 'BIDDING'

  const offscreen = (pos: Pos) => {
    switch (pos) {
      case 'bottom': return { x: 0, y: 120, rot: 0 }
      case 'top':    return { x: 0, y: -120, rot: 180 }
      case 'left':   return { x: -160, y: 0, rot: -15 }
      case 'right':  return { x: 160, y: 0, rot: 15 }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[260px] md:min-h-[320px]">
      <div className="relative">
        {/* Felt circle */}
        <div
          className="rounded-full border border-brass/25 shadow-[inset_0_0_60px_rgba(0,0,0,0.55)]"
          style={{
            width: 240,
            height: 240,
            background:
              'radial-gradient(circle at 50% 40%, rgba(28,82,64,.9), rgba(14,37,28,.95) 70%, rgba(7,18,14,1) 100%)',
          }}
        >
          {/* Inner brass hairline */}
          <div className="absolute inset-3 rounded-full border border-brass/15" />
          {/* Center monogram glints faintly behind the cards */}
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <Monogram size={70} />
          </div>
        </div>

        {/* Played cards */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence>
            {trickPlays.map((p) => {
              const dest = PLAY_OFFSET[p.pos]
              const from = offscreen(p.pos)
              return (
                <motion.div
                  key={`${p.seat}:${p.card.suit}${p.card.rank}`}
                  initial={{ opacity: 0, x: from.x, y: from.y, rotate: from.rot, scale: 0.85 }}
                  animate={{ opacity: 1, x: dest.x, y: dest.y, rotate: dest.rot, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.2 } }}
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

        {/* Idle overlay when nothing has been played yet for this trick */}
        {trickPlays.length === 0 && inAction && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="eyebrow text-ash">
              {view.phase === 'BIDDING' ? t('table.bidding') : t('table.yourTurn').replace(/—/g, '').trim()}
            </div>
            <div className="font-display italic text-cream/80 mt-1 text-sm max-w-[200px]">
              {view.phase === 'BIDDING'
                ? t('bid.waitFor', { n: view.turn + 1 })
                : turnHolderName}
            </div>
          </div>
        )}

        {/* Game over panel */}
        {view.phase === 'GAME_OVER' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="plate px-6 py-4 text-center"
            >
              <div className="eyebrow text-brass mb-1">{t('table.gameOver')}</div>
              <div className="font-display text-cream text-2xl">
                {view.matchScore.NS > view.matchScore.EW ? t('table.teamNS') : t('table.teamEW')}
              </div>
              <div className="font-mono text-brass-hi mt-1 tracking-widest">
                {view.matchScore.NS} : {view.matchScore.EW}
              </div>
            </motion.div>
          </div>
        )}

        {/* Last-trick summary just below the felt when between tricks */}
        {trickPlays.length === 0 && view.lastTrick && view.phase === 'PLAYING' && (
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-display italic text-cream/55 text-xs">
            {t('table.lastTrick', { n: view.lastTrick.winner + 1 })}
          </div>
        )}

        {/* Announcements ribbon above */}
        {view.announcements.length > 0 && view.phase !== 'GAME_OVER' && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex flex-wrap gap-1 justify-center max-w-[320px]">
            {view.announcements.slice(0, 3).map((a, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="chip text-[10px] py-0.5"
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

// Tiny brass tag pinned to the card pointing back at the seat that played it.
function SeatTag({ pos }: { pos: Pos }) {
  // Anchor outside the card edge toward the player.
  const anchor: Record<Pos, React.CSSProperties> = {
    bottom: { left: '50%', bottom: -14, transform: 'translateX(-50%)' },
    top:    { left: '50%', top:    -14, transform: 'translateX(-50%) rotate(180deg)' },
    left:   { top:  '50%', left:   -22, transform: 'translateY(-50%)' },
    right:  { top:  '50%', right:  -22, transform: 'translateY(-50%)' },
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
