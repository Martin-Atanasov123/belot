import { RANKS, SUITS, type Card, type Seat } from '@belot/shared'
import { shuffle, type Rng } from './rng.js'

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

// Belot deal: 3-2-3 (3 to each, then 2 to each, then 3 to each after bidding completes).
// For the engine state machine we deal all 8 upfront for simplicity; the visual 3-2-3 split is
// a UI concern. Bidding still happens with all 8 cards revealed to each player — which matches
// the "5 in one go" variant the spec lists as acceptable. The card distribution is identical.
export function dealHands(deck: readonly Card[], dealer: Seat): Record<Seat, Card[]> {
  if (deck.length !== 32) throw new Error(`deck must be 32 cards, got ${deck.length}`)
  const hands: Record<Seat, Card[]> = { 0: [], 1: [], 2: [], 3: [] }
  // First player to receive is left of dealer (clockwise).
  let i = 0
  let seat = ((dealer + 1) % 4) as Seat
  while (i < 32) {
    hands[seat].push(deck[i]!)
    i++
    seat = ((seat + 1) % 4) as Seat
  }
  return hands
}

export function dealFromSeed(rng: Rng, dealer: Seat): Record<Seat, Card[]> {
  const shuffled = shuffle(buildDeck(), rng)
  return dealHands(shuffled, dealer)
}
