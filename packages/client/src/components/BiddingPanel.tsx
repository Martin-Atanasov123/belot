import type { BidContract } from '@belot/shared'
import { useGame } from '../store/game.js'

const LABELS: Record<BidContract, string> = {
  C: '♣ Спатия',
  D: '♦ Каро',
  H: '♥ Купа',
  S: '♠ Пика',
  NT: 'Без коз',
  AT: 'Всичко коз',
}
const ORDER: BidContract[] = ['C', 'D', 'H', 'S', 'NT', 'AT']

export function BiddingPanel() {
  const view = useGame((s) => s.view)!
  const mySeat = useGame((s) => s.mySeat)
  const send = useGame((s) => s.send)
  const myTurn = view.turn === mySeat
  const currentBidIdx = (() => {
    for (let i = view.bidHistory.length - 1; i >= 0; i--) {
      const h = view.bidHistory[i]
      if (h && h.type === 'BID') return ORDER.indexOf(h.contract)
    }
    return -1
  })()

  if (!myTurn) {
    return (
      <div className="text-center text-emerald-200 text-sm py-2">
        Изчакване ред: <strong>Място {view.turn + 1}</strong>
      </div>
    )
  }

  return (
    <div className="bg-emerald-950/80 rounded-lg p-3 flex flex-wrap gap-2 justify-center">
      <button
        onClick={() => void send({ type: 'PASS', seat: mySeat! })}
        className="rounded bg-stone-700 hover:bg-stone-600 px-3 py-2 font-semibold text-sm"
      >
        Пас
      </button>
      {ORDER.map((c, i) => (
        <button
          key={c}
          disabled={i <= currentBidIdx}
          onClick={() => void send({ type: 'BID', seat: mySeat!, contract: c })}
          className="rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-stone-900 px-3 py-2 font-semibold text-sm"
        >
          {LABELS[c]}
        </button>
      ))}
      <button
        onClick={() => void send({ type: 'CONTRA', seat: mySeat! })}
        className="rounded bg-rose-600 hover:bg-rose-500 px-3 py-2 font-semibold text-sm"
      >
        Контра
      </button>
      <button
        onClick={() => void send({ type: 'RECONTRA', seat: mySeat! })}
        className="rounded bg-rose-700 hover:bg-rose-600 px-3 py-2 font-semibold text-sm"
      >
        Реконтра
      </button>
    </div>
  )
}
