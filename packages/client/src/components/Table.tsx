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

  const trickByVisual: Partial<Record<Pos, Card>> = {}
  if (view.currentTrick) {
    for (const p of view.currentTrick.cards) trickByVisual[visualSeat(p.seat as Seat)] = p.card
  }

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

  const TrickSlot = ({ pos }: { pos: Pos }) => {
    const c = trickByVisual[pos]
    return (
      <AnimatePresence>
        {c && (
          <motion.div
            key={`${c.suit}${c.rank}-${pos}`}
            initial={{ opacity: 0, y: pos === 'bottom' ? 40 : pos === 'top' ? -40 : 0, x: pos === 'left' ? -40 : pos === 'right' ? 40 : 0, rotate: 0 }}
            animate={{ opacity: 1, y: 0, x: 0, rotate: pos === 'left' ? -6 : pos === 'right' ? 6 : pos === 'top' ? 180 : 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            style={{ pointerEvents: 'none' }}
          >
            <CardView card={c} disabled />
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  const contract = view.contract
    ? { ...CONTRACT_GLYPH[view.contract], name: t(`suit.${view.contract}.name` as MessageKey) }
    : null

  return (
    <div className="min-h-screen bg-ink relative overflow-hidden flex flex-col no-select">
      <div className="pointer-events-none absolute inset-0 bg-felt-noise" />

      <CornerOrnament className="absolute top-3 left-3 w-10 h-10 text-brass/30 z-10" />
      <CornerOrnament className="absolute top-3 right-3 w-10 h-10 text-brass/30 z-10" style={{ transform: 'scaleX(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-3 left-3 w-10 h-10 text-brass/30 z-10" style={{ transform: 'scaleY(-1)' } as React.CSSProperties} />
      <CornerOrnament className="absolute bottom-3 right-3 w-10 h-10 text-brass/30 z-10" style={{ transform: 'scale(-1,-1)' } as React.CSSProperties} />

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

      <div className="relative z-10 flex-1 grid grid-rows-[auto_1fr_auto] gap-2 p-4">
        <div className="flex flex-col items-center gap-2">
          <SeatBadge pos="top" />
          <TrickSlot pos="top" />
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            <SeatBadge pos="left" />
            <TrickSlot pos="left" />
          </div>

          <CenterPanel />

          <div className="flex flex-col items-center gap-2">
            <SeatBadge pos="right" />
            <TrickSlot pos="right" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <TrickSlot pos="bottom" />

          {inBidding && <BiddingPanel />}

          <div
            className="hand-scroll flex justify-center items-end gap-[-12px] overflow-x-auto max-w-full px-2"
            style={{ paddingTop: 14 }}
          >
            {view.yourHand.map((c, i) => {
              const total = view.yourHand.length
              const fanCenter = (total - 1) / 2
              const offset = i - fanCenter
              const tilt = offset * 3.2
              return (
                <motion.div
                  key={`${c.suit}${c.rank}-${i}`}
                  initial={{ opacity: 0, y: 36, rotate: tilt - 8 }}
                  animate={{ opacity: 1, y: 0, rotate: tilt }}
                  transition={{ delay: 0.04 * i, type: 'spring', stiffness: 220, damping: 24 }}
                  style={{ marginLeft: i === 0 ? 0 : -14, zIndex: i }}
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

function CenterPanel() {
  const t = useT()
  const view = useGame((s) => s.view)!

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4">
      {view.phase === 'GAME_OVER' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center plate px-8 py-6"
        >
          <div className="eyebrow text-brass mb-2">{t('table.gameOver')}</div>
          <div className="font-display text-cream text-4xl">
            {view.matchScore.NS > view.matchScore.EW ? t('table.teamNS') : t('table.teamEW')}
          </div>
          <div className="font-mono text-brass-hi mt-3 tracking-widest">
            {view.matchScore.NS} : {view.matchScore.EW}
          </div>
        </motion.div>
      ) : view.announcements.length > 0 ? (
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {view.announcements.map((a, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="chip"
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
      ) : view.lastTrick ? (
        <div className="text-center font-display italic text-cream/60">
          {t('table.lastTrick', { n: view.lastTrick.winner + 1 })}
        </div>
      ) : (
        <div className="opacity-50">
          <Monogram size={64} />
        </div>
      )}
    </div>
  )
}
