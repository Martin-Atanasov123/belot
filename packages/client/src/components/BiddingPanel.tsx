import { motion } from 'framer-motion'
import type { BidContract } from '@belot/shared'
import { useGame } from '../store/game.js'

const ORDER: BidContract[] = ['C', 'D', 'H', 'S', 'NT', 'AT']
const SUIT_LABEL: Record<BidContract, { glyph: string; name: string; red: boolean }> = {
  C:  { glyph: '♣', name: 'Спатия',   red: false },
  D:  { glyph: '♦', name: 'Каро',     red: true  },
  H:  { glyph: '♥', name: 'Купа',     red: true  },
  S:  { glyph: '♠', name: 'Пика',     red: false },
  NT: { glyph: '∅', name: 'Без коз',  red: false },
  AT: { glyph: '⁂', name: 'Всичко',   red: false },
}

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
      <div className="text-center py-3">
        <div className="eyebrow text-ash">Наддаване</div>
        <div className="font-display italic text-cream/80 mt-1">
          Изчакване на място <span className="text-brass">{view.turn + 1}</span>…
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="plate px-5 py-4 max-w-[520px]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow text-brass">Наддаване — твой ред</div>
        <button
          onClick={() => void send({ type: 'PASS', seat: mySeat! })}
          className="btn-ghost py-1 px-3 text-[10px]"
        >
          Пас
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {ORDER.map((c, i) => {
          const info = SUIT_LABEL[c]
          const disabled = i <= currentBidIdx
          return (
            <button
              key={c}
              disabled={disabled}
              onClick={() => void send({ type: 'BID', seat: mySeat!, contract: c })}
              className={`plate-cream flex flex-col items-center justify-center py-3 transition ${
                disabled ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-105'
              }`}
            >
              <div
                className={`font-display text-3xl leading-none ${info.red ? 'text-ember' : 'text-stone-900'}`}
              >
                {info.glyph}
              </div>
              <div className="eyebrow text-stone-700 mt-1">{info.name}</div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void send({ type: 'CONTRA', seat: mySeat! })}
          className="btn-ember flex-1"
        >
          Контра
        </button>
        <button
          onClick={() => void send({ type: 'RECONTRA', seat: mySeat! })}
          className="btn-ember flex-1"
        >
          Реконтра
        </button>
      </div>
    </motion.div>
  )
}
