// Client-side hand sorting that mirrors engine ranking — kept local because
// the client doesn't depend on @belot/engine.
import type { Card, Contract, Rank, Suit } from '@belot/shared'

const TRUMP_STRENGTH: Record<Rank, number> = {
  J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1,
}
const PLAIN_STRENGTH: Record<Rank, number> = {
  A: 8, '10': 7, K: 6, Q: 5, J: 4, '9': 3, '8': 2, '7': 1,
}

const PLAIN_SUIT_ORDER: Suit[] = ['S', 'H', 'C', 'D']

function isTrump(card: Card, contract: Contract | null, trump: Suit | null): boolean {
  if (contract === 'AT') return true
  if (contract === 'NT' || contract === null) return false
  return trump !== null && card.suit === trump
}

function strength(card: Card, contract: Contract | null, trump: Suit | null): number {
  return isTrump(card, contract, trump) ? TRUMP_STRENGTH[card.rank] : PLAIN_STRENGTH[card.rank]
}

function suitDisplayOrder(contract: Contract | null, trump: Suit | null): Suit[] {
  if (!contract || contract === 'AT' || contract === 'NT' || trump === null) {
    return PLAIN_SUIT_ORDER
  }
  const others = PLAIN_SUIT_ORDER.filter((s) => s !== trump)
  return [trump as Suit, ...others]
}

export function sortHandForDisplay(
  hand: readonly Card[],
  contract: Contract | null,
  trump: Suit | null,
): Card[] {
  const cards = hand.slice()
  const suitOrder = suitDisplayOrder(contract, trump)
  cards.sort((a, b) => {
    const ai = suitOrder.indexOf(a.suit)
    const bi = suitOrder.indexOf(b.suit)
    if (ai !== bi) return ai - bi
    return strength(b, contract, trump) - strength(a, contract, trump)
  })
  return cards
}
