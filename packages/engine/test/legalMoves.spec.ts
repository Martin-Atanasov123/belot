import { describe, expect, it } from 'vitest'
import { isLegalPlay, legalMoves, trickWinner } from '../src/legalMoves.js'
import type { Card, Trick } from '@belot/shared'

const C = (suit: 'C' | 'D' | 'H' | 'S', rank: Card['rank']): Card => ({ suit, rank })

const newTrick = (leader: 0 | 1 | 2 | 3, cards: { seat: 0 | 1 | 2 | 3; card: Card }[] = []): Trick => ({
  leader,
  cards,
})

describe('legalMoves', () => {
  it('leader may play anything', () => {
    const hand = [C('H', '7'), C('D', 'A')]
    expect(legalMoves(hand, newTrick(0), 'H', 'H')).toHaveLength(2)
  })

  it('must follow suit if able', () => {
    const hand = [C('H', '7'), C('D', 'A'), C('D', '10')]
    const trick = newTrick(0, [{ seat: 0, card: C('D', '8') }])
    const legal = legalMoves(hand, trick, 'C', 'C')
    expect(legal).toEqual([C('D', 'A'), C('D', '10')])
  })

  it('NT contract never requires trumping', () => {
    const hand = [C('S', '7'), C('S', '8')]
    const trick = newTrick(0, [{ seat: 0, card: C('D', 'A') }])
    const legal = legalMoves(hand, trick, 'NT', null)
    expect(legal).toEqual(hand)
  })

  it('trump contract: must trump when cannot follow', () => {
    const hand = [C('S', '7'), C('H', 'J')] // H is trump
    const trick = newTrick(0, [{ seat: 0, card: C('D', 'A') }])
    const legal = legalMoves(hand, trick, 'H', 'H')
    expect(legal).toEqual([C('H', 'J')])
  })

  it('over-trump rule: must rise above current trump if possible', () => {
    // Trump H. Led D. Seat1 trumped with H-Q. Seat2 cannot follow D, has H-J and H-8.
    // Must over-trump: only H-J qualifies (Q strength=3, J strength=8).
    const hand = [C('H', 'J'), C('H', '8'), C('C', '7')]
    const trick = newTrick(0, [
      { seat: 0, card: C('D', 'A') },
      { seat: 1, card: C('H', 'Q') },
    ])
    const legal = legalMoves(hand, trick, 'H', 'H')
    expect(legal).toEqual([C('H', 'J')])
  })

  it('if cannot over-trump, may play any trump (under-trumping allowed)', () => {
    const hand = [C('H', '8'), C('H', '7'), C('C', 'A')]
    const trick = newTrick(0, [
      { seat: 0, card: C('D', 'A') },
      { seat: 1, card: C('H', 'J') }, // already highest trump
    ])
    const legal = legalMoves(hand, trick, 'H', 'H')
    expect(legal.sort((a, b) => a.rank.localeCompare(b.rank))).toEqual([C('H', '7'), C('H', '8')].sort((a, b) => a.rank.localeCompare(b.rank)))
  })

  it('partner-winning exception: may discard freely when partner is currently winning', () => {
    // Seat 0 leads D-A. Seat 1 follows D-7. Seat 2 (partner of seat 0) is the current "next actor"
    // — wait, seat 2 is the next actor (leader=0, length=2 → seat 2). Seat 0 is partner of seat 2
    // and currently winning. Seat 2 has no D, has trumps and side cards.
    const hand = [C('S', '7'), C('H', 'J')]
    const trick = newTrick(0, [
      { seat: 0, card: C('D', 'A') },
      { seat: 1, card: C('D', '7') },
    ])
    const legal = legalMoves(hand, trick, 'C', 'C') // trump=C, none in hand
    expect(legal).toEqual(hand)
  })

  it('led-suit-is-trump: must rise above current trump', () => {
    const hand = [C('H', 'A'), C('H', '7')]
    const trick = newTrick(0, [
      { seat: 0, card: C('H', '10') }, // trump led, currently winning
    ])
    const legal = legalMoves(hand, trick, 'H', 'H')
    // A trump (strength 6) > 10 (strength 5) → must play A; 7 not legal.
    expect(legal).toEqual([C('H', 'A')])
  })

  it('isLegalPlay rejects cards not in hand', () => {
    const hand = [C('H', '7')]
    expect(isLegalPlay(C('H', '8'), hand, newTrick(0), 'H', 'H')).toBe(false)
  })

  it('trickWinner: trump beats led suit', () => {
    const trick = newTrick(0, [
      { seat: 0, card: C('D', 'A') },
      { seat: 1, card: C('H', '7') }, // trump
      { seat: 2, card: C('D', 'K') },
      { seat: 3, card: C('D', '10') },
    ])
    expect(trickWinner(trick, 'H', 'H')).toBe(1)
  })

  it('trickWinner: highest of led suit wins when no trump', () => {
    const trick = newTrick(0, [
      { seat: 0, card: C('D', '10') },
      { seat: 1, card: C('C', 'A') },
      { seat: 2, card: C('D', 'A') }, // wins led suit
      { seat: 3, card: C('S', '7') },
    ])
    expect(trickWinner(trick, 'H', 'H')).toBe(2)
  })

  it('AT contract: every suit is trump, must over-trump when possible', () => {
    const hand = [C('D', 'J'), C('D', '7')]
    const trick = newTrick(0, [{ seat: 0, card: C('D', '10') }])
    const legal = legalMoves(hand, trick, 'AT', null)
    // J is trump (highest), 10 was current best → J required.
    expect(legal).toEqual([C('D', 'J')])
  })

  // ─── AT trick-winner: same-suit beats same-suit; cross-suit cannot win ───
  it('AT: 9♠ leads, J♥ from another seat does NOT beat it (no suit dominates)', () => {
    const trick = newTrick(0, [
      { seat: 0, card: C('S', '9') },  // led
      { seat: 1, card: C('H', 'J') },  // different suit — cannot win
    ])
    expect(trickWinner(trick, 'AT', null)).toBe(0)
  })

  it('AT: highest of led suit wins regardless of other suits played', () => {
    const trick = newTrick(0, [
      { seat: 0, card: C('S', '9') },   // led
      { seat: 1, card: C('S', 'J') },   // higher led-suit → winning
      { seat: 2, card: C('H', 'J') },   // different suit → doesn't matter
      { seat: 3, card: C('S', '7') },   // led suit but weaker
    ])
    expect(trickWinner(trick, 'AT', null)).toBe(1)
  })

  it('AT: when cannot follow led suit, free discard (no must-trump)', () => {
    // Led ♠, hand has only hearts → all of them are legal discards.
    const hand = [C('H', 'A'), C('H', '7'), C('H', 'J')]
    const trick = newTrick(0, [{ seat: 0, card: C('S', '10') }])
    const legal = legalMoves(hand, trick, 'AT', null)
    expect(legal).toEqual(hand)
  })

  it('AT: when partner is winning, may follow without over-trumping', () => {
    // Seats: 0,2 = NS partners; 1,3 = EW. Trick led by 0, currently seat 2 (partner of 0) winning.
    const trick = newTrick(0, [
      { seat: 0, card: C('S', '10') },
      { seat: 1, card: C('S', '7') },
      { seat: 2, card: C('S', 'J') }, // partner winning
    ])
    // Seat 3 (next actor) holds ♠Q and ♠9. Standard rule: needn't over-trump partner.
    const hand = [C('S', 'Q'), C('S', '9')]
    const legal = legalMoves(hand, trick, 'AT', null)
    expect(legal).toEqual(hand)
  })

  it('NT: cross-suit cannot win (sanity check, existing behaviour preserved)', () => {
    const trick = newTrick(0, [
      { seat: 0, card: C('S', '9') },
      { seat: 1, card: C('H', 'J') },
    ])
    expect(trickWinner(trick, 'NT', null)).toBe(0)
  })
})
