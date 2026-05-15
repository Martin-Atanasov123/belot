import { describe, expect, it } from 'vitest'
import { basePointsForContract, cardPoints, cardStrength, isTrump } from '../src/ranking.js'
import { buildDeck } from '../src/deck.js'
import type { Card } from '@belot/shared'

const c = (suit: 'C' | 'D' | 'H' | 'S', rank: Card['rank']): Card => ({ suit, rank })

describe('ranking', () => {
  it('trump ranking points match BG rules', () => {
    expect(cardPoints(c('H', 'J'), 'H', 'H')).toBe(20)
    expect(cardPoints(c('H', '9'), 'H', 'H')).toBe(14)
    expect(cardPoints(c('H', 'A'), 'H', 'H')).toBe(11)
    expect(cardPoints(c('H', '10'), 'H', 'H')).toBe(10)
    expect(cardPoints(c('H', 'K'), 'H', 'H')).toBe(4)
    expect(cardPoints(c('H', 'Q'), 'H', 'H')).toBe(3)
    expect(cardPoints(c('H', '8'), 'H', 'H')).toBe(0)
    expect(cardPoints(c('H', '7'), 'H', 'H')).toBe(0)
  })

  it('non-trump ranking points', () => {
    expect(cardPoints(c('D', 'A'), 'H', 'H')).toBe(11)
    expect(cardPoints(c('D', '10'), 'H', 'H')).toBe(10)
    expect(cardPoints(c('D', 'K'), 'H', 'H')).toBe(4)
    expect(cardPoints(c('D', 'Q'), 'H', 'H')).toBe(3)
    expect(cardPoints(c('D', 'J'), 'H', 'H')).toBe(2)
    expect(cardPoints(c('D', '9'), 'H', 'H')).toBe(0)
  })

  it('AT treats every suit as trump', () => {
    expect(cardPoints(c('D', 'J'), 'AT', null)).toBe(20)
    expect(isTrump(c('S', 'J'), 'AT', null)).toBe(true)
  })

  it('NT treats every suit as non-trump', () => {
    expect(cardPoints(c('H', 'J'), 'NT', null)).toBe(2)
    expect(isTrump(c('H', 'J'), 'NT', null)).toBe(false)
  })

  it('trump strength orders J > 9 > A > 10 > K > Q > 8 > 7', () => {
    const order = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'] as const
    for (let i = 0; i < order.length - 1; i++) {
      expect(cardStrength(c('H', order[i]), 'H', 'H')).toBeGreaterThan(
        cardStrength(c('H', order[i + 1]), 'H', 'H'),
      )
    }
  })

  it('non-trump strength orders A > 10 > K > Q > J > 9 > 8 > 7', () => {
    const order = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'] as const
    for (let i = 0; i < order.length - 1; i++) {
      expect(cardStrength(c('D', order[i]), 'H', 'H')).toBeGreaterThan(
        cardStrength(c('D', order[i + 1]), 'H', 'H'),
      )
    }
  })

  it('whole deck sums to the contract base', () => {
    const deck = buildDeck()
    expect(deck.length).toBe(32)
    // trump contract H: trump suit = 62, three plain suits = 30 each → 62 + 90 = 152
    const sumH = deck.reduce((s, card) => s + cardPoints(card, 'H', 'H'), 0)
    expect(sumH).toBe(basePointsForContract('H'))
    expect(sumH).toBe(152)
    // AT: 62 × 4 = 248
    const sumAT = deck.reduce((s, card) => s + cardPoints(card, 'AT', null), 0)
    expect(sumAT).toBe(248)
    // NT: 30 × 4 = 120
    const sumNT = deck.reduce((s, card) => s + cardPoints(card, 'NT', null), 0)
    expect(sumNT).toBe(120)
  })
})
