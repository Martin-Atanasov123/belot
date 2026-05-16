import { RANKS, SUITS, type Card, type Seat } from '@belot/shared'
import { shuffle, type Rng } from './rng.js'

export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

// Internal helper: distribute `perSeat` cards each, starting at `startIndex` of the deck,
// in seat order beginning with (dealer+1).
function distribute(
  deck: readonly Card[],
  dealer: Seat,
  startIndex: number,
  perSeat: number,
  hands: Record<Seat, Card[]>,
): Record<Seat, Card[]> {
  let i = startIndex
  for (let n = 0; n < perSeat; n++) {
    for (let off = 0; off < 4; off++) {
      const seat = ((dealer + 1 + off) % 4) as Seat
      hands[seat].push(deck[i]!)
      i++
    }
  }
  return hands
}

// First round of the Bulgarian deal: 5 cards to each player (effectively 3+2,
// the engine doesn't care about the visual subdivision).
export function dealFirstFive(deck: readonly Card[], dealer: Seat): Record<Seat, Card[]> {
  if (deck.length !== 32) throw new Error(`deck must be 32 cards, got ${deck.length}`)
  const hands: Record<Seat, Card[]> = { 0: [], 1: [], 2: [], 3: [] }
  return distribute(deck, dealer, 0, 5, hands)
}

// Second round: deal the remaining 3 to each player after bidding concludes.
// Returns NEW hand objects (immutable in spirit) so callers can swap snapshots safely.
export function dealLastThree(
  deck: readonly Card[],
  dealer: Seat,
  fiveCardHands: Record<Seat, Card[]>,
): Record<Seat, Card[]> {
  if (deck.length !== 32) throw new Error(`deck must be 32 cards, got ${deck.length}`)
  const hands: Record<Seat, Card[]> = {
    0: fiveCardHands[0].slice(),
    1: fiveCardHands[1].slice(),
    2: fiveCardHands[2].slice(),
    3: fiveCardHands[3].slice(),
  }
  return distribute(deck, dealer, 20, 3, hands)
}

// Convenience: full 8-card deal in one go. Kept for tests and rare callers.
export function dealHands(deck: readonly Card[], dealer: Seat): Record<Seat, Card[]> {
  return dealLastThree(deck, dealer, dealFirstFive(deck, dealer))
}

export function shuffledDeck(rng: Rng): Card[] {
  return shuffle(buildDeck(), rng)
}

// Backwards-compatible: full deal from seed. Used by `dealRound1FromSeed` and tests.
export function dealFromSeed(rng: Rng, dealer: Seat): Record<Seat, Card[]> {
  return dealHands(shuffledDeck(rng), dealer)
}
