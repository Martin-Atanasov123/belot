import { describe, expect, it } from 'vitest'
import {
  findCarresInHand,
  findSequencesInHand,
  resolveAnnouncements,
  scanHand,
} from '../src/announcements.js'
import type { Card, Seat } from '@belot/shared'

const C = (suit: 'C' | 'D' | 'H' | 'S', rank: Card['rank']): Card => ({ suit, rank })

describe('announcements: sequences', () => {
  it('detects терца (3-in-a-row) = 20', () => {
    const hand = [C('H', '8'), C('H', '9'), C('H', '10'), C('C', 'A')]
    const seqs = findSequencesInHand(hand)
    expect(seqs).toEqual([{ suit: 'H', topRank: '10', length: 3, points: 20 }])
  })

  it('detects кварта (4-in-a-row) = 50', () => {
    const hand = [C('D', 'J'), C('D', 'Q'), C('D', 'K'), C('D', 'A')]
    const seqs = findSequencesInHand(hand)
    expect(seqs).toEqual([{ suit: 'D', topRank: 'A', length: 4, points: 50 }])
  })

  it('detects квинта (5+) = 100, capped at length 5 for type', () => {
    const hand = [C('S', '10'), C('S', 'J'), C('S', 'Q'), C('S', 'K'), C('S', 'A')]
    const seqs = findSequencesInHand(hand)
    expect(seqs[0]!.points).toBe(100)
    expect(seqs[0]!.length).toBeGreaterThanOrEqual(5)
  })

  it('does not detect a sequence broken by missing rank', () => {
    const hand = [C('H', '8'), C('H', '10'), C('H', 'J')]
    expect(findSequencesInHand(hand)).toEqual([])
  })

  it('detects two separate sequences in the same hand', () => {
    const hand = [
      C('H', '7'), C('H', '8'), C('H', '9'),
      C('S', 'Q'), C('S', 'K'), C('S', 'A'),
    ]
    const seqs = findSequencesInHand(hand)
    expect(seqs).toHaveLength(2)
  })
})

describe('announcements: carrés', () => {
  it('Jacks = 200', () => {
    const hand = [C('H', 'J'), C('D', 'J'), C('S', 'J'), C('C', 'J')]
    expect(findCarresInHand(hand)).toEqual([{ rank: 'J', points: 200 }])
  })

  it('Nines = 150', () => {
    const hand = [C('H', '9'), C('D', '9'), C('S', '9'), C('C', '9')]
    expect(findCarresInHand(hand)).toEqual([{ rank: '9', points: 150 }])
  })

  it('Aces/Ks/Qs/10s = 100', () => {
    for (const r of ['A', 'K', 'Q', '10'] as const) {
      const hand = [C('H', r), C('D', r), C('S', r), C('C', r)]
      expect(findCarresInHand(hand)).toEqual([{ rank: r, points: 100 }])
    }
  })

  it('no carré for 7s/8s', () => {
    const hand7 = [C('H', '7'), C('D', '7'), C('S', '7'), C('C', '7')]
    const hand8 = [C('H', '8'), C('D', '8'), C('S', '8'), C('C', '8')]
    expect(findCarresInHand(hand7)).toEqual([])
    expect(findCarresInHand(hand8)).toEqual([])
  })
})

describe('announcements: team resolution', () => {
  const seatHand = (seat: Seat, hand: Card[]) => scanHand(hand, seat)

  it('higher sequence wins outright', () => {
    const perSeat = [
      seatHand(0, [C('H', '7'), C('H', '8'), C('H', '9')]),                   // терца at 9
      seatHand(1, [C('D', 'J'), C('D', 'Q'), C('D', 'K'), C('D', 'A')]),       // кварта at A
      seatHand(2, []),
      seatHand(3, []),
    ]
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBe('EW')
    expect(r.totalPoints).toBe(50)
  })

  it('TIED терци: trump-suit announcement wins', () => {
    // Both 3-in-a-row up to 10. NS in hearts (trump), EW in spades (non-trump).
    const perSeat = [
      seatHand(0, [C('H', '8'), C('H', '9'), C('H', '10')]),
      seatHand(1, [C('S', '8'), C('S', '9'), C('S', '10')]),
      seatHand(2, []),
      seatHand(3, []),
    ]
    const r = resolveAnnouncements(perSeat, 'H', 'H')
    expect(r.winningTeam).toBe('NS')
  })

  it('TIED терци and neither in trump: seat-order tiebreak (lowest seat wins)', () => {
    const perSeat = [
      seatHand(1, [C('S', '8'), C('S', '9'), C('S', '10')]), // EW seat 1
      seatHand(2, [C('D', '8'), C('D', '9'), C('D', '10')]), // NS seat 2
    ]
    const r = resolveAnnouncements(perSeat, 'C', 'C') // trump=clubs, neither in trump
    expect(r.winningTeam).toBe('EW') // lowest seat number = 1
  })

  it('carré beats any sequence', () => {
    const perSeat = [
      seatHand(0, [C('S', '10'), C('S', 'J'), C('S', 'Q'), C('S', 'K'), C('S', 'A')]), // квинта 100
      seatHand(1, [C('H', 'J'), C('D', 'J'), C('S', 'J'), C('C', 'J')]),                // carré jacks 200
      seatHand(2, []),
      seatHand(3, []),
    ]
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBe('EW')
    expect(r.announcements.some((a) => a.kind === 'carre' && a.points === 200)).toBe(true)
  })

  it('no announcements anywhere → empty', () => {
    const perSeat = ([0, 1, 2, 3] as Seat[]).map((s) => seatHand(s, []))
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBeNull()
    expect(r.totalPoints).toBe(0)
  })

  it('winning team accumulates ALL its sequences', () => {
    const perSeat = [
      seatHand(0, [C('H', 'Q'), C('H', 'K'), C('H', 'A')]),  // 20
      seatHand(1, [C('C', '7'), C('C', '8'), C('C', '9')]),  // 20
      seatHand(2, [C('S', 'J'), C('S', 'Q'), C('S', 'K'), C('S', 'A')]), // 50
      seatHand(3, []),
    ]
    // NS best = кварта 50; EW best = терца 20 → NS wins. NS sums seat0 (20) + seat2 (50) = 70.
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBe('NS')
    expect(r.totalPoints).toBe(70)
  })
})
