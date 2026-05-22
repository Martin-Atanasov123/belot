import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../store/game.js'
import { useT } from '../i18n/index.js'
import { CardView } from './Card.js'
import { BiddingPanel } from './BiddingPanel.js'
import { Monogram } from './Ornaments.js'
import { VictoryOverlay } from './VictoryOverlay.js'
import { LanguageToggle } from './LanguageToggle.js'
import { FloatingReactions, ReactionsBar } from './Reactions.js'
import { sortHandForDisplay } from '../lib/sortHand.js'
import type { Announcement, BidContract, BidHistoryEntry, Card, LastHandResult, Seat } from '@belot/shared'
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
  const r = mobile ? 30 : 70
  switch (pos) {
    case 'bottom': return { x:  0, y:  r, rot:   2 }
    case 'top':    return { x:  0, y: -r, rot: 182 }
    case 'left':   return { x: -r, y:  0, rot: -10 }
    case 'right':  return { x:  r, y:  0, rot:  10 }
  }
}

function offFelt(pos: Pos, mobile: boolean): { x: number; y: number } {
  const big = mobile ? 100 : 220
  switch (pos) {
    case 'bottom': return { x: 0,    y:  big }
    case 'top':    return { x: 0,    y: -big }
    case 'left':   return { x: -big, y:    0 }
    case 'right':  return { x:  big, y:    0 }
  }
}

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
  const mySeat = useGame((s) => s.mySeat)
  const amSpectator = useGame((s) => s.amSpectator)
  const send = useGame((s) => s.send)
  const isMobile = useIsMobile()

  // Spectators view the felt with seat 0 (South) at the bottom — no rotation,
  // since they have no seat of their own. Otherwise rotate so your seat is bottom.
  const visualSeat = (seat: Seat): Pos => {
    const anchor = mySeat ?? 0
    const rel = (seat - anchor + 4) % 4
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

  // Sort the player's hand for display: trump suit first (during suit contracts),
  // strongest cards within each suit, alternating colours otherwise.
  const sortedHand = useMemo(
    () => sortHandForDisplay(view.yourHand, view.contract, view.trump),
    [view.yourHand, view.contract, view.trump],
  )

  const isMyTurn = mySeat !== null && view.turn === mySeat
  const inBidding = view.phase === 'BIDDING'
  const inPlay = view.phase === 'PLAYING'

  // Table composition — how many seats are real people vs bots. Especially
  // useful in quick matches so you know who you're actually playing with.
  const humanCount = room.seats.filter((s) => !s.isBot && s.nickname !== null).length
  const botCount = room.seats.filter((s) => s.isBot).length

  const onPlay = (card: Card) => {
    if (mySeat === null) return // spectators can't play
    void send({ type: 'PLAY', seat: mySeat, card })
  }

  const collectionWinnerPos: Pos | null =
    trickPlays.length === 4 ? visualSeat(view.turn) : null

  const actionsBySeat = useMemo(
    () => lastActionsPerSeat(view.bidHistory),
    [view.bidHistory],
  )
  const liveBid = lastBidEntry(view.bidHistory)

  // ── Seat badge (no "Място N") ─────────────────────────────────────────
  const SeatBadge = ({ pos, compact = false }: { pos: Pos; compact?: boolean }) => {
    const seat = seatByPos[pos]
    const occ = room.seats[seat]
    const isActive = view.turn === seat && (inBidding || inPlay)
    const myBadge = mySeat !== null && seat === mySeat
    const size = compact ? 'px-2 py-1 min-w-[78px] max-w-[110px]' : 'px-4 py-3 min-w-[140px] sm:min-w-[170px]'
    const lastAct = inBidding ? actionsBySeat[seat] : null

    return (
      <motion.div
        layout
        // Per spec §18: active player gets a STATIC glow, not a brass pulse animation.
        // The `seat-active-static` utility comes from index.css.
        className={`relative plate ${size} inline-flex flex-col items-center gap-0.5 ${
          isActive ? 'seat-active-static' : ''
        }`}
        {...(isActive ? { style: { borderColor: 'rgba(230,193,120,0.85)' } } : {})}
      >
        <div className={`font-display text-cream leading-tight truncate ${
          compact ? 'text-[13px] max-w-[88px]' : 'text-lg sm:text-2xl max-w-[180px] sm:max-w-[220px]'
        } ${myBadge ? 'text-brass-hi' : ''}`}>
          {occ?.nickname ?? '—'}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`font-mono text-brass tracking-[0.14em] ${compact ? 'text-[8px]' : 'text-[10px] sm:text-xs'}`}>
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

        {/* Bidding action bubble */}
        <AnimatePresence>
          {lastAct && (
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
          )}
        </AnimatePresence>

        {/* Glow ring for active player */}
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
  const bidderName = view.bidder !== null ? room.seats[view.bidder]?.nickname ?? null : null

  const [historyOpen, setHistoryOpen] = useState(false)

  // ── Layout — Tier B (Battlefield) per design spec §17/18.
  // No film grain, no ornaments, no atmospheric glows. Flat racing background.
  // The `tier-b` class drops --grain-opacity to 0 globally for this view.
  return (
    <div className="tier-b battlefield min-h-[100dvh] relative overflow-hidden flex flex-col no-select">

      <header className="relative z-20 border-b border-brass/15 bg-racing/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-2 sm:px-5 py-1.5 sm:py-3 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              to="/"
              className="shrink-0 font-mono text-ash hover:text-brass-hi transition text-xs sm:text-sm tracking-widest uppercase leading-none"
              title={t('rules.backHome')}
            >
              ←
            </Link>
            <Monogram size={isMobile ? 22 : 36} />
            <div className="min-w-0">
              <div className="eyebrow text-ash leading-none text-[9px] sm:text-[11px]">{t('table.room')}</div>
              <div className="font-mono text-brass tracking-[0.22em] sm:tracking-[0.28em] text-xs sm:text-base">{room.code}</div>
            </div>
            {/* Real-people vs bots composition */}
            <div
              className="flex items-center gap-1 font-mono text-[9px] sm:text-[11px] tracking-[0.12em] leading-none"
              title={t('table.tableComposition')}
            >
              <span className="text-cream/85">{humanCount}</span>
              <span className="text-ash uppercase">{t('table.humansShort')}</span>
              <span className="text-brass/40">·</span>
              <span className="text-brass-hi">{botCount}</span>
              <span className="text-ash uppercase">{t('table.botsShort')}</span>
            </div>
            <div className="hidden md:block ml-2">
              <div className="eyebrow text-ash leading-none">{t('table.handLabel')}</div>
              <div className="font-display italic text-cream text-base">{t('table.handNo', { n: view.handNo })}</div>
            </div>
            {room.spectatorCount > 0 && (
              <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-brass-hi tracking-[0.14em]">
                <span>·</span>
                <span>{t('table.spectatorCount', { n: room.spectatorCount })}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              title={t('table.openHistory')}
              className="plate px-2 sm:px-4 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-3 font-mono text-xs sm:text-base hover:brightness-110 transition"
            >
              <div className="text-center leading-none">
                <div className="eyebrow text-ash text-[8px] sm:text-[10px]">NS</div>
                <div className="text-cream text-sm sm:text-xl">{view.matchScore.NS}</div>
              </div>
              <div className="w-px h-5 sm:h-9 bg-brass/30" />
              <div className="text-center leading-none">
                <div className="eyebrow text-ash text-[8px] sm:text-[10px]">EW</div>
                <div className="text-cream text-sm sm:text-xl">{view.matchScore.EW}</div>
              </div>
              <span className="hidden sm:inline text-brass/60 text-base ml-1">⌄</span>
            </button>
            <LanguageToggle />
          </div>
        </div>

        <div className="md:hidden flex items-center justify-between px-2 pb-1.5 gap-2 text-xs">
          <div className="font-display italic text-cream/80">
            {t('table.handLabel')} {t('table.handNo', { n: view.handNo })}
          </div>
          {contract ? (
            <ContractChip contract={contract} multiplier={view.multiplier} bidder={bidderName} small />
          ) : (
            <div className="chip py-0.5 text-[10px]">{t('table.bidding')}</div>
          )}
        </div>

        <div className="hidden md:flex absolute right-52 top-1/2 -translate-y-1/2">
          {contract ? (
            <ContractChip contract={contract} multiplier={view.multiplier} bidder={bidderName} />
          ) : (
            <div className="chip">{t('table.bidding')}</div>
          )}
        </div>
      </header>

      <MatchHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* MAIN AREA — two layouts share the same children but arrange them
          differently. Mobile (default) stacks opponents above, felt in middle.
          Desktop (sm+) uses 3-column grid with left/right badges flanking. */}
      <div className="relative z-10 flex-1 flex flex-col items-center gap-2 sm:gap-2 px-2 sm:px-4 pt-3 pb-1 sm:pb-3">

        {/* Mobile: top seat alone (partner) */}
        <div className="sm:hidden flex justify-center pt-1">
          <SeatBadge pos="top" compact />
        </div>

        {/* Desktop: top seat alone */}
        <div className="hidden sm:flex justify-center">
          <SeatBadge pos="top" />
        </div>

        {/* Middle row — left badge | felt | right badge (both mobile and desktop) */}
        <div className="flex-1 w-full flex items-center justify-center">

          {/* Desktop: 3-column grid with side badges + felt */}
          <div className="hidden sm:grid w-full grid-cols-[auto_1fr_auto] items-center gap-1 sm:gap-3">
            <div className="flex justify-start">
              <SeatBadge pos="left" />
            </div>
            <PlayZone
              trickPlays={trickPlays}
              isMobile={false}
              collectionWinnerPos={collectionWinnerPos}
              liveBid={liveBid}
            />
            <div className="flex justify-end">
              <SeatBadge pos="right" />
            </div>
          </div>

          {/* Mobile: 3-column grid with compact side badges flanking the felt */}
          <div className="sm:hidden w-full grid grid-cols-[auto_1fr_auto] items-center gap-1">
            <div className="flex justify-start">
              <SeatBadge pos="left" compact />
            </div>
            <PlayZone
              trickPlays={trickPlays}
              isMobile={true}
              collectionWinnerPos={collectionWinnerPos}
              liveBid={liveBid}
            />
            <div className="flex justify-end">
              <SeatBadge pos="right" compact />
            </div>
          </div>
        </div>

        {/* Bottom: your tools (bidding + hand + badge) */}
        <div className="flex flex-col items-center gap-1.5 sm:gap-3 w-full">
          {inBidding && !amSpectator && <BiddingPanel />}

          {amSpectator && (
            <div className="plate px-4 py-2 font-display italic text-cream/80 text-sm sm:text-base">
              {t('table.spectating')}
              {room.spectatorCount > 1 && (
                <span className="ml-2 font-mono text-[10px] text-ash">
                  · {t('table.spectatorCount', { n: room.spectatorCount })}
                </span>
              )}
            </div>
          )}

          {/* "You can announce" hint — players only */}
          {!amSpectator && <YourCombosHint />}

          <div
            className="hand-scroll flex justify-center items-end overflow-x-auto max-w-full px-1"
            style={{ paddingTop: 14 }}
          >
            {sortedHand.map((c, i) => {
              const total = sortedHand.length
              const fanCenter = (total - 1) / 2
              const offset = i - fanCenter
              const tilt = (isMobile ? 2.4 : 3.6) * offset
              const lift = Math.abs(offset) * (isMobile ? 1 : 3)
              const overlap = isMobile ? -14 : -22
              return (
                <motion.div
                  key={`${c.suit}${c.rank}`}
                  layout
                  initial={{ opacity: 0, y: 36, rotate: tilt - 8 }}
                  animate={{ opacity: 1, y: lift, rotate: tilt }}
                  transition={{ delay: 0.04 * i, type: 'spring', stiffness: 220, damping: 24 }}
                  {...(inPlay && isMyTurn ? { whileHover: { y: lift - 18 } } : {})}
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

      {/* Dynamic announcement banner (appears, lingers ~4s, fades) */}
      <AnnouncementsBanner />

      {/* Hand-result overlay shown briefly at the start of a new hand */}
      <HandResultBanner />

      {/* Cinematic victory / defeat overlay — only when match ends */}
      {view.phase === 'GAME_OVER' && <VictoryOverlay />}

      {/* Quick reactions — bottom-right button + floating emotes near seats */}
      <ReactionsBar canReact={mySeat !== null} />
      <FloatingReactions visualPosForSeat={visualSeat} />
    </div>
  )
}

// ── Per-seat last action bubble ───────────────────────────────────────
function BidBubble({ action, compact }: { action: SeatBidAction; compact: boolean }) {
  if (!action) return null
  const base = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
    compact ? 'text-[10px]' : 'text-xs'
  } font-mono tracking-[0.14em] whitespace-nowrap`

  if (action.type === 'PASS') {
    return (
      <div className={`${base} bg-stone-900/60 border-stone-500/40 text-stone-300`}>ПАС</div>
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

// ── Your-combinations hint ─────────────────────────────────────────────
// Shows the player what announcements they hold (before trick 1 freezes them).
function YourCombosHint() {
  const view = useGame((s) => s.view)!
  // Show during BIDDING (so the player can decide whether their hand is worth bidding)
  // and during PLAYING up until announcements freeze (= before the first trick resolves).
  // We approximate the freeze: announcements is non-empty once any team's are recorded;
  // and `lastTrick` becomes non-null only after the very first trick collects.
  const showDuringBidding = view.phase === 'BIDDING'
  const showDuringFirstTrick = view.phase === 'PLAYING' && view.lastTrick === null
  if (!showDuringBidding && !showDuringFirstTrick) return null
  if (view.contract === 'NT') return null
  if (!view.yourPotentialAnnouncements || view.yourPotentialAnnouncements.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="plate-cream px-3 py-1.5 flex flex-wrap items-center gap-1.5 max-w-[420px]"
    >
      <span className="eyebrow text-stone-700 text-[9px] sm:text-[10px]">Държиш</span>
      {view.yourPotentialAnnouncements.map((a, i) => (
        <CombinationChip key={i} a={a} />
      ))}
    </motion.div>
  )
}

function CombinationChip({ a }: { a: Announcement }) {
  if (a.kind === 'sequence') {
    return (
      <span className="font-mono text-[10px] tracking-[0.12em] px-1.5 py-0.5 rounded bg-emerald-900/15 border border-stone-500/30 text-stone-800">
        {a.length === 3 ? 'Терца' : a.length === 4 ? 'Кварта' : 'Квинта'} {SUIT_GLYPH[a.suit]}
        <span className="text-brass-hi ml-1">+{a.points}</span>
      </span>
    )
  }
  if (a.kind === 'carre') {
    return (
      <span className="font-mono text-[10px] tracking-[0.12em] px-1.5 py-0.5 rounded bg-emerald-900/15 border border-stone-500/30 text-stone-800">
        Каре {a.rank}<span className="text-brass-hi ml-1">+{a.points}</span>
      </span>
    )
  }
  if (a.kind === 'belot') {
    return (
      <span className="font-mono text-[10px] tracking-[0.12em] px-1.5 py-0.5 rounded bg-amber-900/20 border border-amber-700/40 text-stone-800">
        Белот {SUIT_GLYPH[a.suit]}<span className="text-brass-hi ml-1">+20</span>
      </span>
    )
  }
  return null
}

// ── Hand-result modal — per design spec §11 РЕЗУЛТАТ НА РЪКА ───────────
// Full-screen `void/85` overlay. Centered `plate-cream` panel with:
//  · header (Раздаване N · contract glyph · ×N multiplier · close)
//  · bidder + outcome badge (brass / ember-hi / ash by outcome)
//  · breakdown rows (Карти / Обявки / Белот / Капо)
//  · ruled total + ÷10 board row
//  · running match score row (NEW — running cumulative NS vs EW)
//  · "Следваща ръка ({count})" brass button (NEW — countdown from 8s, click dismisses)
function HandResultBanner() {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const [visible, setVisible] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(8)
  // StrictMode-safe ref pattern (mirrors AnnouncementsBanner above).
  const shownForHandRef = useRef<number | null>(null)
  const showAtRef = useRef<number>(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const r = view.lastHandResult

  const clearTimers = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (dismissRef.current) { clearTimeout(dismissRef.current); dismissRef.current = null }
  }, [])

  const dismiss = useCallback(() => {
    clearTimers()
    setVisible(false)
  }, [clearTimers])

  // Trigger once per new handNo.
  useEffect(() => {
    if (!r) return
    if (shownForHandRef.current === r.handNo) return
    shownForHandRef.current = r.handNo
    clearTimers()
    setVisible(true)
    setSecondsLeft(8)
    showAtRef.current = Date.now()
    tickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - showAtRef.current) / 1000)
      const remaining = Math.max(0, 8 - elapsed)
      setSecondsLeft(remaining)
    }, 250)
    dismissRef.current = setTimeout(() => {
      setVisible(false)
      clearTimers()
    }, 8000)
  }, [r, clearTimers])

  // Cleanup only on unmount (StrictMode safe).
  useEffect(() => () => clearTimers(), [clearTimers])

  if (!r) return null

  const onBackdrop = () => {
    // Anti-misclick: ignore click-outside in the first 2 seconds.
    if (Date.now() - showAtRef.current < 2000) return
    dismiss()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onBackdrop}
          className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-void/85 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md"
          >
            <HandResultCard
              r={r}
              bidderName={room.seats[r.bidder]?.nickname ?? '—'}
              matchScore={view.matchScore}
              secondsLeft={secondsLeft}
              onClose={dismiss}
              nextLabel={t('result.nextCountdown', { n: secondsLeft })}
              t={t}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function HandResultCard({
  r,
  bidderName,
  matchScore,
  secondsLeft: _secondsLeft,
  onClose,
  nextLabel,
  t,
}: {
  r: LastHandResult
  bidderName: string
  matchScore: { NS: number; EW: number }
  secondsLeft: number
  onClose: () => void
  nextLabel: string
  t: ReturnType<typeof useT>
}) {
  const outcomeLabel =
    r.outcome === 'made'
      ? t('result.made')
      : r.outcome === 'inside'
        ? t('result.inside')
        : t('result.suspended')
  const outcomeColor =
    r.outcome === 'made'
      ? 'text-brass-hi'
      : r.outcome === 'inside'
        ? 'text-ember-hi'
        : 'text-ash'
  const c = CONTRACT_GLYPH[r.contract]
  const nsLeads = matchScore.NS > matchScore.EW
  const ewLeads = matchScore.EW > matchScore.NS

  return (
    <div className="plate-cream p-5 sm:p-7 text-sm shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2.5">
          <div className="eyebrow text-stone-700 text-[10px]">
            {t('result.title')} № {r.handNo}
          </div>
          <span
            className={`font-mono text-xl leading-none ${
              c.red ? 'text-ember' : 'text-stone-900'
            }`}
          >
            {c.glyph}
          </span>
          {r.multiplier > 1 && (
            <span className="font-mono text-xs font-bold text-ember tracking-widest">
              ×{r.multiplier}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.cancel')}
          className="w-8 h-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 text-xl leading-none rounded hover:bg-stone-900/5 transition"
        >
          ×
        </button>
      </div>

      {/* Bidder + outcome badge */}
      <div className="flex items-baseline justify-between mb-4">
        <div className="font-display italic text-stone-800 text-base">{bidderName}</div>
        <div className={`font-display italic font-bold text-lg ${outcomeColor}`}>
          {outcomeLabel}
        </div>
      </div>

      {/* Breakdown */}
      <ResultRowCream label={t('result.cards')} ns={r.cardPoints.NS} ew={r.cardPoints.EW} />
      {(r.announcementPoints.NS + r.announcementPoints.EW) > 0 && (
        <ResultRowCream
          label={t('result.announ')}
          ns={r.announcementPoints.NS}
          ew={r.announcementPoints.EW}
        />
      )}
      {(r.belotPoints.NS + r.belotPoints.EW) > 0 && (
        <ResultRowCream
          label={t('result.belot')}
          ns={r.belotPoints.NS}
          ew={r.belotPoints.EW}
        />
      )}
      {r.capot && (
        <ResultRowCream
          label={`${t('result.capot')} +90`}
          ns={r.capot === 'NS' ? 90 : 0}
          ew={r.capot === 'EW' ? 90 : 0}
        />
      )}

      <div
        aria-hidden
        className="h-px my-3"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(120,90,40,.55) 50%, transparent)',
        }}
      />

      <ResultRowCream
        label={t('result.total')}
        ns={r.awardedRaw.NS}
        ew={r.awardedRaw.EW}
        bold
      />
      <ResultRowCream
        label={t('result.toBoard')}
        ns={r.awardedTens.NS}
        ew={r.awardedTens.EW}
        bold
        brass
      />

      {/* Running match score — NEW per spec */}
      <div
        aria-hidden
        className="h-px my-3"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(120,90,40,.55) 50%, transparent)',
        }}
      />

      <div className="text-center">
        <div className="eyebrow text-stone-700">{t('result.matchScore')}</div>
        <div className="mt-2 flex items-baseline justify-center gap-4 sm:gap-6 font-mono">
          <div className="text-right">
            <div className="text-[10px] text-stone-600 tracking-widest">{t('table.teamNS')}</div>
            <div
              className={`text-3xl sm:text-4xl font-bold ${
                nsLeads ? 'text-brass' : 'text-stone-900'
              }`}
            >
              {matchScore.NS}
            </div>
          </div>
          <div className="text-stone-600 text-2xl leading-none">:</div>
          <div className="text-left">
            <div className="text-[10px] text-stone-600 tracking-widest">{t('table.teamEW')}</div>
            <div
              className={`text-3xl sm:text-4xl font-bold ${
                ewLeads ? 'text-brass' : 'text-stone-900'
              }`}
            >
              {matchScore.EW}
            </div>
          </div>
        </div>
      </div>

      {/* Next-hand button with countdown */}
      <button
        onClick={onClose}
        className="btn-brass w-full mt-5"
      >
        {nextLabel}
      </button>
    </div>
  )
}

// Variant of ResultRow tuned for the plate-cream (light) modal background.
function ResultRowCream({
  label,
  ns,
  ew,
  bold,
  brass,
}: {
  label: string
  ns: number
  ew: number
  bold?: boolean
  brass?: boolean
}) {
  const color = brass
    ? 'text-brass'
    : bold
      ? 'text-stone-900'
      : 'text-stone-700'
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] items-baseline gap-3 font-mono text-[12px] py-0.5 ${color} ${
        bold ? 'font-bold' : ''
      }`}
    >
      <span className={bold ? 'font-display italic not-italic' : ''}>{label}</span>
      <span className="text-right tabular-nums w-10">{ns}</span>
      <span className="text-right tabular-nums w-10">{ew}</span>
    </div>
  )
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
    const o = offFelt(cardPos, isMobile)
    return { x: o.x * 0.5, y: o.y * 0.5, scale: 0.7, opacity: 0, transition: { duration: 0.3 } }
  }

  const feltSize = isMobile ? 200 : 320
  const monoSize = isMobile ? 56 : 96
  const turnHolderName = room.seats[view.turn]?.nickname ?? '—'
  const liveBidName = liveBid ? room.seats[liveBid.seat]?.nickname ?? '—' : null

  return (
    <div className="flex items-center justify-center w-full">
      <div className="relative" style={{ width: feltSize, height: feltSize }}>
        {/* Felt circle */}
        <div
          className="absolute inset-0 rounded-full border border-brass/25 shadow-[inset_0_0_60px_rgba(0,0,0,0.55)]"
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(28,82,64,.9), rgba(14,37,28,.95) 70%, rgba(7,18,14,1) 100%)',
          }}
        />
        <div className="absolute inset-2 sm:inset-3 rounded-full border border-brass/15" />
        <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
          <Monogram size={monoSize} />
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

        {/* Idle overlay */}
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

        {/* Waiting-for caption */}
        {inPlay && trickPlays.length > 0 && trickPlays.length < 4 && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] sm:text-xs tracking-[0.18em] text-brass uppercase">
            ↻ {t('table.waitingFor')} {turnHolderName}
          </div>
        )}

        {/* Collected by caption */}
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

        {/* Game over — moved out of the felt into a full-screen cinematic overlay
            (see <VictoryOverlay/> rendered at the root of <Table/>). */}

        {/* Dynamic announcements banner — see <AnnouncementsBanner/> rendered separately */}
      </div>
    </div>
  )
}

// ── Big animated banner that appears when new announcements get awarded and
// fades out a few seconds later. Triggered by a change in view.handNo+announcements.
function AnnouncementsBanner() {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track which (hand, announcement-count) we've already shown for. Including the
  // announcement count means a freshly-added belot mid-hand re-triggers the banner
  // (carrés/sequences fire on trick 1, belot fires later when the second K/Q lands).
  const shownForSigRef = useRef<string | null>(null)

  const handSig = `${view.handNo}:${view.announcements.length}`
  const hasAnn = view.announcements.length > 0

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setVisible(false)
  }, [clearTimer])

  // Trigger the banner once per hand. Note: cleanup function is intentionally
  // omitted so React 18 StrictMode double-invoke doesn't kill the timer.
  useEffect(() => {
    if (!hasAnn) {
      setVisible(false)
      return
    }
    if (shownForSigRef.current === handSig) return
    shownForSigRef.current = handSig
    clearTimer()
    setVisible(true)
    timerRef.current = setTimeout(() => {
      setVisible(false)
      timerRef.current = null
    }, 4000)
  }, [hasAnn, handSig, clearTimer])

  // Cleanup only on unmount.
  useEffect(() => () => clearTimer(), [clearTimer])

  const show = visible && hasAnn
  if (view.phase === 'GAME_OVER') return null

  // Winning team summary
  const team = view.announcements[0] ? (view.announcements[0].seat === 0 || view.announcements[0].seat === 2 ? 'NS' : 'EW') : null
  const total = view.announcements.reduce((s, a) => s + a.points, 0)
  const teamLabel = team === 'NS' ? t('table.teamNS') : team === 'EW' ? t('table.teamEW') : ''

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20, transition: { duration: 0.5 } }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          className="absolute z-30 left-2 sm:left-6 bottom-24 sm:bottom-44"
        >
          <div className="plate px-3 py-2 max-w-[78vw] sm:max-w-[260px] border border-brass-hi/40">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="eyebrow text-brass-hi text-[9px]">{t('table.combinations')}</span>
              <div className="flex items-center gap-2">
                {teamLabel && <span className="font-display italic text-cream/70 text-[10px]">{teamLabel}</span>}
                <button
                  type="button"
                  onClick={dismiss}
                  onTouchEnd={(e) => { e.preventDefault(); dismiss() }}
                  className="text-ash hover:text-cream active:text-brass-hi transition leading-none text-[18px] font-bold w-7 h-7 -my-1 -mr-1 flex items-center justify-center rounded-full hover:bg-ash/10 touch-manipulation"
                  aria-label="Затвори"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {view.announcements.slice(0, 3).map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.08 }}
                  className="font-mono text-[11px] text-cream flex items-center gap-1.5 whitespace-nowrap"
                >
                  {a.kind === 'sequence' && (
                    <>
                      <span className="text-cream/80">
                        {a.length === 3 ? 'Терца' : a.length === 4 ? 'Кварта' : 'Квинта'}
                      </span>
                      <span className="text-ember-hi">{SUIT_GLYPH[a.suit]}</span>
                      <span className="text-brass-hi">+{a.points}</span>
                    </>
                  )}
                  {a.kind === 'carre' && (
                    <>
                      <span className="text-cream/80">Каре {a.rank}</span>
                      <span className="text-brass-hi">+{a.points}</span>
                    </>
                  )}
                  {a.kind === 'belot' && (
                    <>
                      <span className="text-cream/80">Белот</span>
                      <span className="text-ember-hi">{SUIT_GLYPH[a.suit]}</span>
                      <span className="text-brass-hi">+20</span>
                    </>
                  )}
                </motion.div>
              ))}
              {view.announcements.length > 3 && (
                <div className="font-mono text-[10px] text-ash italic">
                  +{view.announcements.length - 3} още…
                </div>
              )}
            </div>
            {total > 0 && (
              <div className="mt-1 pt-1 border-t border-brass/20 font-mono text-brass-hi text-[11px] flex justify-between">
                <span className="text-cream/60 italic">{room.seats[view.announcements[0]?.seat ?? 0]?.nickname ?? ''}</span>
                <span>∑ +{total}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

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

// ── Contract chip (suit + name + bidder + multiplier) ─────────────────
function ContractChip({
  contract,
  multiplier,
  bidder,
  small,
}: {
  contract: { glyph: string; red: boolean; name: string }
  multiplier: number
  bidder: string | null
  small?: boolean
}) {
  return (
    <div className={`chip ${small ? 'py-0.5 text-[10px]' : 'text-sm'}`}>
      <span className={`${small ? 'text-sm' : 'text-lg'} leading-none ${contract.red ? 'text-ember-hi' : 'text-brass-hi'}`}>
        {contract.glyph}
      </span>
      <span>{contract.name}</span>
      {bidder && <span className="text-cream/85">· {bidder}</span>}
      {multiplier > 1 && <span className="text-ember-hi">×{multiplier}</span>}
    </div>
  )
}

// ── Match history modal (score-board ▸ open ▸ per-hand breakdown) ─────
function MatchHistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  if (!open) return null

  const history = view.handHistory ?? []
  return (
    <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="plate w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-brass/20">
          <div>
            <div className="eyebrow text-brass">{t('table.matchHistory')}</div>
            <div className="font-display italic text-cream/80 text-sm">
              NS {view.matchScore.NS} · EW {view.matchScore.EW}
            </div>
          </div>
          <button onClick={onClose} className="text-ash hover:text-cream text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-3">
          {history.length === 0 ? (
            <div className="font-display italic text-cream/60 text-center py-6">{t('table.historyEmpty')}</div>
          ) : (
            <table className="w-full text-[12px] font-mono">
              <thead>
                <tr className="text-ash">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1 pr-2">{t('table.contract')}</th>
                  <th className="text-left py-1 pr-2">{t('table.bidderColumn')}</th>
                  <th className="text-right py-1 pr-2">NS</th>
                  <th className="text-right py-1">EW</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx} className="border-t border-brass/10 align-top">
                    <td className="py-1.5 pr-2 text-cream/70">{h.handNo}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`${CONTRACT_GLYPH[h.contract].red ? 'text-ember-hi' : 'text-brass-hi'}`}>
                        {CONTRACT_GLYPH[h.contract].glyph}
                      </span>{' '}
                      <span className="text-cream">{h.contract}</span>
                      {h.multiplier > 1 && <span className="text-ember-hi ml-1">×{h.multiplier}</span>}
                      {h.capot && <span className="text-brass-hi ml-1">капо</span>}
                      <div className="text-ash text-[10px] mt-0.5">
                        {h.outcome === 'made' ? 'изкарана' : h.outcome === 'inside' ? 'вкарана' : 'висяща'}
                      </div>
                      {h.announcements.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {h.announcements.map((a, i) => (
                            <span key={i} className="text-[10px] tracking-[0.12em] px-1.5 py-0.5 rounded bg-emerald-900/15 border border-stone-500/30 text-stone-300">
                              {a.kind === 'sequence' && `${a.length}×${SUIT_GLYPH[a.suit]} +${a.points}`}
                              {a.kind === 'carre' && `Каре ${a.rank} +${a.points}`}
                              {a.kind === 'belot' && `Белот +20`}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-cream/85">
                      {room.seats[h.bidder]?.nickname ?? '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <span className="text-cream">{h.awardedTens.NS}</span>
                      <div className="text-ash text-[10px]">{h.awardedRaw.NS}</div>
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="text-cream">{h.awardedTens.EW}</span>
                      <div className="text-ash text-[10px]">{h.awardedRaw.EW}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-brass/30">
                  <td colSpan={3} className="py-2 font-display italic text-brass">{t('table.totalRow')}</td>
                  <td className="py-2 text-right text-cream-hi text-base">{view.matchScore.NS}</td>
                  <td className="py-2 text-right text-cream-hi text-base">{view.matchScore.EW}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </motion.div>
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
