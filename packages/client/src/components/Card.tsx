import { motion } from 'framer-motion'
import type { Card } from '@belot/shared'

const SUIT_GLYPH: Record<Card['suit'], string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const SUIT_NAME_BG: Record<Card['suit'], string> = {
  C: 'Спатия', D: 'Каро', H: 'Купа', S: 'Пика',
}
const RED: ReadonlySet<Card['suit']> = new Set(['D', 'H'])

// Face cards use a calligraphic letter; number cards use a small grid of pips.
// Layout positions are normalized (0..1) within the inner face area.
type PipPos = [number, number]
const PIP_LAYOUTS: Record<string, PipPos[]> = {
  '7': [[0.5,0.18],[0.2,0.32],[0.8,0.32],[0.2,0.68],[0.8,0.68],[0.5,0.82],[0.5,0.5]],
  '8': [[0.2,0.18],[0.8,0.18],[0.2,0.4],[0.8,0.4],[0.2,0.6],[0.8,0.6],[0.2,0.82],[0.8,0.82]],
  '9': [[0.2,0.18],[0.8,0.18],[0.5,0.32],[0.2,0.46],[0.8,0.46],[0.2,0.6],[0.8,0.6],[0.5,0.68],[0.2,0.82],[0.8,0.82]].slice(0,9) as PipPos[],
  '10':[[0.2,0.18],[0.8,0.18],[0.5,0.28],[0.2,0.4],[0.8,0.4],[0.2,0.6],[0.8,0.6],[0.5,0.72],[0.2,0.82],[0.8,0.82]],
  'A': [[0.5,0.5]],
}

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
  const glyph = SUIT_GLYPH[card.suit]
  const red = RED.has(card.suit)
  const isFace = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K'
  const rankLabel = card.rank // '7','8',...,'10','J','Q','K','A'

  return (
    <motion.div
      className={small ? 'card-small' : ''}
      {...(layoutId ? { layoutId } : {})}
      {...(disabled ? {} : { whileTap: { scale: 0.97 } })}
    >
      <div
        className={`card-face ${red ? 'is-red' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
        title={`${rankLabel} ${SUIT_NAME_BG[card.suit]}`}
      >
        <div className="corner corner-top">
          <span className="rank">{rankLabel}</span>
          <span className="suit">{glyph}</span>
        </div>

        <div className="face-body">
          {isFace ? (
            <FaceFigure rank={rankLabel as 'J' | 'Q' | 'K'} glyph={glyph} />
          ) : card.rank === 'A' ? (
            <span className="pip-ace">{glyph}</span>
          ) : (
            <PipsGrid layout={PIP_LAYOUTS[rankLabel] ?? PIP_LAYOUTS['A']!} glyph={glyph} />
          )}
        </div>

        <div className="corner corner-bot">
          <span className="rank">{rankLabel}</span>
          <span className="suit">{glyph}</span>
        </div>
      </div>
    </motion.div>
  )
}

function FaceFigure({ rank, glyph }: { rank: 'J' | 'Q' | 'K'; glyph: string }) {
  return (
    <div className="face-figure">
      <div className="face-letter">{rank}</div>
      <div className="face-suit">{glyph}</div>
    </div>
  )
}

function PipsGrid({ layout, glyph }: { layout: PipPos[]; glyph: string }) {
  return (
    <div className="pip-grid">
      {layout.map(([x, y], i) => (
        <span
          key={i}
          className="pip-dot"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%, -50%) ${y > 0.5 ? 'rotate(180deg)' : ''}` }}
        >
          {glyph}
        </span>
      ))}
    </div>
  )
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div className={small ? 'card-small' : ''}>
      <div className="card-back" />
    </div>
  )
}
