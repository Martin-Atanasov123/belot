import type { Card } from '@belot/shared'

const SUIT_GLYPH: Record<Card['suit'], string> = {
  C: '♣', // ♣
  D: '♦', // ♦
  H: '♥', // ♥
  S: '♠', // ♠
}

const RED: ReadonlySet<Card['suit']> = new Set(['D', 'H'])

const SUIT_NAME_BG: Record<Card['suit'], string> = {
  C: 'Спатия',
  D: 'Каро',
  H: 'Купа',
  S: 'Пика',
}

export function CardView({
  card,
  onClick,
  disabled,
  small,
}: {
  card: Card
  onClick?: () => void
  disabled?: boolean
  small?: boolean
}) {
  return (
    <div
      className={`card ${RED.has(card.suit) ? 'red' : ''} ${disabled ? 'disabled' : ''}`}
      style={small ? { width: 36, height: 52, padding: '2px 4px' } : undefined}
      onClick={disabled ? undefined : onClick}
      title={`${card.rank} ${SUIT_NAME_BG[card.suit]}`}
    >
      <div className="text-sm font-bold leading-none">{card.rank === '10' ? '10' : card.rank}</div>
      <div className="text-xl leading-none">{SUIT_GLYPH[card.suit]}</div>
      <div className="text-sm font-bold leading-none rotate-180">{card.rank === '10' ? '10' : card.rank}</div>
    </div>
  )
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div
      className="rounded-md border border-stone-300 shadow-md"
      style={{
        width: small ? 36 : 56,
        height: small ? 52 : 80,
        backgroundImage:
          'repeating-linear-gradient(45deg, #1e40af 0 8px, #1e3a8a 8px 16px)',
      }}
    />
  )
}
