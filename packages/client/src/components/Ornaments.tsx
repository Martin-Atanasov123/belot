// Hand-drawn SVG ornaments — used as section dividers and corner flourishes.
// Pure SVG so they scale crisply and animate cheaply.

export function Flourish({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 24"
      className={`overflow-visible ${className}`}
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
        <path d="M2 12 L86 12" />
        <path d="M86 12 C 96 4, 108 4, 110 12 C 112 20, 124 20, 134 12" />
        <path d="M134 12 L218 12" />
        <circle cx="110" cy="12" r="2.2" fill="currentColor" />
        <path d="M70 12 l -4 -4 M70 12 l -4 4" />
        <path d="M150 12 l 4 -4 M150 12 l 4 4" />
      </g>
    </svg>
  )
}

export function CornerOrnament({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg viewBox="0 0 80 80" className={className} style={style} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M2 30 Q 2 2, 30 2" />
        <path d="M14 30 Q 14 14, 30 14" opacity=".55" />
        <circle cx="30" cy="30" r="2" fill="currentColor" />
        <path d="M30 2 L34 6 L38 2" opacity=".7" />
        <path d="M2 30 L6 34 L2 38" opacity=".7" />
      </g>
    </svg>
  )
}

export function Monogram({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="brassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6c178" />
          <stop offset="100%" stopColor="#a98640" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#brassGrad)" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="url(#brassGrad)" strokeWidth=".6" opacity=".5" />
      <text
        x="50" y="62"
        textAnchor="middle"
        fontFamily="EB Garamond, Georgia, serif"
        fontSize="42"
        fontStyle="italic"
        fill="url(#brassGrad)"
      >Б</text>
    </svg>
  )
}

export function SuitGlyph({ suit, className = '' }: { suit: 'C' | 'D' | 'H' | 'S'; className?: string }) {
  const map = { C: '♣', D: '♦', H: '♥', S: '♠' }
  return <span className={className}>{map[suit]}</span>
}
