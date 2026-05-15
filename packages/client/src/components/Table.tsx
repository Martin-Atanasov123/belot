import { useMemo } from 'react'
import { useGame } from '../store/game.js'
import { CardView, CardBack } from './Card.js'
import { BiddingPanel } from './BiddingPanel.js'
import type { Card, Seat } from '@belot/shared'

const SUIT_GLYPH: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const CONTRACT_LABEL: Record<string, string> = {
  C: '♣ Спатия', D: '♦ Каро', H: '♥ Купа', S: '♠ Пика', NT: 'Без коз', AT: 'Всичко коз',
}

export function Table() {
  const view = useGame((s) => s.view)!
  const room = useGame((s) => s.room)!
  const mySeat = useGame((s) => s.mySeat)!
  const send = useGame((s) => s.send)

  // Map absolute seats to visual positions relative to me: bottom, left, top, right.
  const visualSeat = (seat: Seat): 'bottom' | 'left' | 'top' | 'right' => {
    const rel = (seat - mySeat + 4) % 4
    return (['bottom', 'left', 'top', 'right'] as const)[rel]!
  }

  const seatByPos = useMemo(() => {
    const m: Record<'bottom' | 'left' | 'top' | 'right', Seat> = { bottom: 0, left: 1, top: 2, right: 3 }
    for (const s of [0, 1, 2, 3] as Seat[]) m[visualSeat(s)] = s
    return m
  }, [mySeat])

  const trickByVisual: Record<string, Card | undefined> = {}
  if (view.currentTrick) {
    for (const p of view.currentTrick.cards) trickByVisual[visualSeat(p.seat as Seat)] = p.card
  }

  const isMyTurn = view.turn === mySeat
  const inBidding = view.phase === 'BIDDING'
  const inPlay = view.phase === 'PLAYING'

  const onPlay = (card: Card) => {
    void send({ type: 'PLAY', seat: mySeat, card })
  }

  const seatLabel = (pos: 'bottom' | 'left' | 'top' | 'right') => {
    const seat = seatByPos[pos]
    const occ = room.seats[seat]
    return (
      <div className={`flex flex-col items-center gap-1 ${view.turn === seat ? 'ring-2 ring-amber-400 rounded p-1' : ''}`}>
        <div className="seat-label">{occ?.nickname ?? '—'}</div>
        <div className="text-xs text-emerald-300">{view.handCounts[seat]} карти</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-4 text-sm bg-emerald-950/60">
        <span>Стая <strong>{room.code}</strong></span>
        <span>Раздаване #{view.handNo}</span>
        {view.contract && (
          <span>Договор: <strong>{CONTRACT_LABEL[view.contract]}</strong>{view.multiplier > 1 ? ` ×${view.multiplier}` : ''}</span>
        )}
        <span className="ml-auto">NS {view.matchScore.NS} : {view.matchScore.EW} EW</span>
      </div>

      {/* Table grid: top / middle (left + trick + right) / bottom */}
      <div className="flex-1 grid grid-rows-[auto_1fr_auto] grid-cols-1 p-3 gap-2 bg-emerald-900">
        <div className="flex justify-center items-center gap-3">
          {seatLabel('top')}
          {trickByVisual.top && <CardView card={trickByVisual.top} disabled small />}
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center">
          <div className="flex items-center gap-2">
            {seatLabel('left')}
            {trickByVisual.left && <CardView card={trickByVisual.left} disabled small />}
          </div>

          <div className="flex flex-col items-center gap-2">
            {view.contract === null && inBidding && (
              <div className="text-emerald-200 text-sm">Наддаване</div>
            )}
            {view.phase === 'GAME_OVER' && (
              <div className="text-3xl font-bold text-amber-300">Край! NS {view.matchScore.NS} — {view.matchScore.EW} EW</div>
            )}
            {view.lastTrick && view.phase !== 'PLAYING' && (
              <div className="text-emerald-200 text-xs">Последен взет от: място {view.lastTrick.winner + 1}</div>
            )}
            {view.announcements.length > 0 && (
              <div className="text-emerald-200 text-xs flex flex-wrap gap-1 justify-center max-w-md">
                {view.announcements.map((a, i) => (
                  <span key={i} className="bg-emerald-700 rounded px-2 py-0.5">
                    {a.kind === 'sequence' && `${a.length} в ${SUIT_GLYPH[a.suit]} (+${a.points})`}
                    {a.kind === 'carre' && `Каре ${a.rank} (+${a.points})`}
                    {a.kind === 'belot' && `Белот (+20)`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {trickByVisual.right && <CardView card={trickByVisual.right} disabled small />}
            {seatLabel('right')}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          {trickByVisual.bottom && <CardView card={trickByVisual.bottom} disabled small />}
          {inBidding && <BiddingPanel />}
          <div className="flex gap-1 overflow-x-auto max-w-full">
            {view.yourHand.map((c, i) => (
              <CardView
                key={`${c.suit}${c.rank}-${i}`}
                card={c}
                onClick={() => onPlay(c)}
                disabled={!(inPlay && isMyTurn)}
              />
            ))}
          </div>
          <div className="text-emerald-300 text-xs">
            {seatLabel('bottom')}
            {isMyTurn ? <span className="ml-2 text-amber-300">твой ред</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// silence unused import warning for CardBack in some bundlers
void CardBack
