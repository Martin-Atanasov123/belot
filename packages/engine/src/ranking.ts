import type { Card, Contract, Rank, Suit } from '@belot/shared'

// Trump ranking: J=20, 9=14, A=11, 10=10, K=4, Q=3, 8=0, 7=0
// Trump strength (for trick comparison): J > 9 > A > 10 > K > Q > 8 > 7
const TRUMP_POINTS: Record<Rank, number> = {
  J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0,
}
const TRUMP_STRENGTH: Record<Rank, number> = {
  J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1,
}

// Non-trump ranking: A=11, 10=10, K=4, Q=3, J=2, 9=0, 8=0, 7=0
// Non-trump strength: A > 10 > K > Q > J > 9 > 8 > 7
const PLAIN_POINTS: Record<Rank, number> = {
  A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0,
}
const PLAIN_STRENGTH: Record<Rank, number> = {
  A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1,
}

export function isTrump(card: Card, contract: Contract, trump: Suit | null): boolean {
  if (contract === 'AT') return true
  if (contract === 'NT') return false
  return trump !== null && card.suit === trump
}

export function cardPoints(card: Card, contract: Contract, trump: Suit | null): number {
  if (isTrump(card, contract, trump)) return TRUMP_POINTS[card.rank]
  return PLAIN_POINTS[card.rank]
}

export function cardStrength(card: Card, contract: Contract, trump: Suit | null): number {
  if (isTrump(card, contract, trump)) return TRUMP_STRENGTH[card.rank]
  return PLAIN_STRENGTH[card.rank]
}

// Sum of points across the whole deck for a given contract (sanity-checks scoring).
export function basePointsForContract(contract: Contract): number {
  // Trump suit: 20+14+11+10+4+3 = 62; Non-trump: 11+10+4+3+2 = 30.
  // Trump contract (C/D/H/S): 62 + 3×30 = 152. + 10 last trick = 162.
  // AT: 62 × 4 = 248. + 10 last trick = 258. But per common BG belote, AT base = 258 → halved/doubled
  //   variants exist; we store the *raw* card pool, multipliers applied in scoring.
  // NT: 30 × 4 = 120. + 10 last trick = 130. Doubled in scoring.
  if (contract === 'AT') return 248
  if (contract === 'NT') return 120
  return 152
}

// Rank order in a suit for sequence (терца/кварта/...) detection.
// Per BG belote: 7 < 8 < 9 < 10 < J < Q < K < A within a suit, independent of trump.
export const SEQUENCE_RANK_ORDER: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const sequencePos = (r: Rank): number => SEQUENCE_RANK_ORDER.indexOf(r)
