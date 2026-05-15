import { describe, expect, it } from 'vitest'
import { buildDeck, dealFromSeed, dealHands } from '../src/deck.js'
import { mulberry32 } from '../src/rng.js'

describe('deck', () => {
  it('builds 32 unique cards', () => {
    const d = buildDeck()
    expect(d.length).toBe(32)
    const set = new Set(d.map((c) => `${c.suit}${c.rank}`))
    expect(set.size).toBe(32)
  })

  it('deals 8 cards to each seat starting left of dealer', () => {
    const d = buildDeck()
    const hands = dealHands(d, 3)
    expect(hands[0].length).toBe(8)
    expect(hands[1].length).toBe(8)
    expect(hands[2].length).toBe(8)
    expect(hands[3].length).toBe(8)
    // First card goes to seat 0 (dealer+1).
    expect(hands[0][0]).toEqual(d[0])
    expect(hands[1][0]).toEqual(d[1])
  })

  it('rejects non-32-card decks', () => {
    expect(() => dealHands([], 0)).toThrow()
  })

  it('deal is deterministic for the same seed', () => {
    const a = dealFromSeed(mulberry32(42), 0)
    const b = dealFromSeed(mulberry32(42), 0)
    expect(a).toEqual(b)
  })
})
