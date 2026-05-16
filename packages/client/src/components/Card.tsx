import { motion } from 'framer-motion'
import type { Card } from '@belot/shared'

const SUIT_GLYPH: Record<Card['suit'], string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const SUIT_NAME_BG: Record<Card['suit'], string> = {
  C: 'Спатия', D: 'Каро', H: 'Купа', S: 'Пика',
}
const RED: ReadonlySet<Card['suit']> = new Set(['D', 'H'])

export function CardView({
  card,
  onClick,
  disabled,
  small,
  layoutId,
}: {
  card: Card
  onClick?: () => void
  disabled?: boolean
  small?: boolean
  layoutId?: string
}) {
  const rank = card.rank === '10' ? '10' : card.rank
  const glyph = SUIT_GLYPH[card.suit]
  const red = RED.has(card.suit)

  return (
    <motion.div
      className={small ? 'card-small' : ''}
      {...(layoutId ? { layoutId } : {})}
      {...(disabled ? {} : { whileTap: { scale: 0.97 } })}
    >
      <div
        className={`card-face ${red ? 'is-red' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
        title={`${rank} ${SUIT_NAME_BG[card.suit]}`}
      >
        <div className="corner corner-top">
          <span className="rank">{rank}</span>
          <span className="suit">{glyph}</span>
        </div>
        <div className="pip">{glyph}</div>
        <div className="corner corner-bot">
          <span className="rank">{rank}</span>
          <span className="suit">{glyph}</span>
        </div>
      </div>
    </motion.div>
  )
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div className={small ? 'card-small' : ''}>
      <div className="card-back" />
    </div>
  )
}
