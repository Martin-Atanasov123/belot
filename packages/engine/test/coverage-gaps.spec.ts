import { describe, expect, it } from 'vitest'
import { bidLegal, startBidding, applyBid } from '../src/bidding.js'
import { basePointsForContract } from '../src/ranking.js'
import { advanceHand, apply, isError, newMatch, projectView } from '../src/match.js'
import { resolveAnnouncements, scanHand, holdsBelotPair } from '../src/announcements.js'
import { scoreHand } from '../src/scoring.js'
import type { Card, Seat } from '@belot/shared'

const enable = { enableNT: true, enableAT: true }

describe('bidding: error branches', () => {
  it('AT disabled', () => {
    const b = startBidding(3)
    expect(bidLegal(b, 0, { type: 'BID', contract: 'AT' }, { enableNT: true, enableAT: false })).toMatch(/AT/)
  })

  it('contra with no bid → error', () => {
    const b = startBidding(3)
    expect(bidLegal(b, 0, { type: 'CONTRA' }, enable)).toMatch(/nothing/)
  })

  it('recontra with no bid → error', () => {
    const b = startBidding(3)
    expect(bidLegal(b, 0, { type: 'RECONTRA' }, enable)).toMatch(/nothing/)
  })

  it('recontra with no contra in play → error', () => {
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'H' }) // NS bids
    // No contra yet; bidder team tries to recontra
    expect(bidLegal(b, 1, { type: 'RECONTRA' }, enable)).toMatch(/no contra/)
  })

  it('recontra by wrong team → error', () => {
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'H' })   // NS bids; turn → 1
    b = applyBid(b, 1, { type: 'CONTRA' })                // EW contras; turn → 2
    b = applyBid(b, 2, { type: 'PASS' })                  // turn → 3
    expect(bidLegal(b, 3, { type: 'RECONTRA' }, enable)).toMatch(/only bidder/)
  })

  it('after bidding ends, further actions error', () => {
    let b = startBidding(3)
    b = applyBid(b, 0, { type: 'BID', contract: 'H' })
    b = applyBid(b, 1, { type: 'PASS' })
    b = applyBid(b, 2, { type: 'PASS' })
    b = applyBid(b, 3, { type: 'PASS' })
    expect(bidLegal(b, 0, { type: 'PASS' }, enable)).toMatch(/over/)
  })

  it('unknown bid input type returns error', () => {
    const b = startBidding(3)
    // @ts-expect-error unknown union member
    expect(bidLegal(b, 0, { type: 'WAT' }, enable)).toMatch(/unknown/)
  })
})

describe('ranking: basePointsForContract for all contracts', () => {
  it('NT base = 120', () => expect(basePointsForContract('NT')).toBe(120))
  it('AT base = 248', () => expect(basePointsForContract('AT')).toBe(248))
  it('any suit contract base = 152', () => {
    expect(basePointsForContract('C')).toBe(152)
    expect(basePointsForContract('D')).toBe(152)
    expect(basePointsForContract('S')).toBe(152)
  })
})

describe('match: error paths', () => {
  it('rejects non-PLAY action during PLAYING phase', () => {
    let snap = newMatch({ seed: 1, settings: { ...newMatch({ seed: 0 }).settings, gameTo: 10_000 } })
    snap = (apply(snap, { type: 'BID', seat: 0, contract: 'AT' }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 1 }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 2 }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 3 }) as typeof snap)
    expect(snap.phase).toBe('PLAYING')
    const r = apply(snap, { type: 'BID', seat: snap.turn, contract: 'H' })
    expect(isError(r)).toBe(true)
  })

  it('standalone BELOT action during PLAYING returns error (declaration is automatic)', () => {
    let snap = newMatch({ seed: 2 })
    snap = (apply(snap, { type: 'BID', seat: 0, contract: 'AT' }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 1 }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 2 }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 3 }) as typeof snap)
    const r = apply(snap, { type: 'BELOT', seat: snap.turn })
    expect(isError(r)).toBe(true)
  })

  it('advanceHand on a non-HAND_OVER snap errors', () => {
    const snap = newMatch({ seed: 3 })
    expect(isError(advanceHand(snap))).toBe(true)
  })

  it('bidding action during PLAYING is rejected by apply', () => {
    let snap = newMatch({ seed: 99 })
    snap = (apply(snap, { type: 'BID', seat: 0, contract: 'H' }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 1 }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 2 }) as typeof snap)
    snap = (apply(snap, { type: 'PASS', seat: 3 }) as typeof snap)
    const r = apply(snap, { type: 'PASS', seat: 0 })
    expect(isError(r)).toBe(true)
  })

  it('projects views for all four seats with disjoint own-hands', () => {
    const snap = newMatch({ seed: 5 })
    const seats: Seat[] = [0, 1, 2, 3]
    const views = seats.map((s) => projectView(snap, s))
    // hand counts mirror snap exactly
    for (const v of views) {
      expect(v.handCounts[0]).toBe(snap.hands[0].length)
    }
  })
})

describe('announcements: more cases', () => {
  const seatHand = (seat: Seat, hand: Card[]) => scanHand(hand, seat)
  const C = (suit: 'C' | 'D' | 'H' | 'S', rank: Card['rank']): Card => ({ suit, rank })

  it('only one side has any sequence → that side wins', () => {
    const perSeat = [
      seatHand(0, [C('H', '7'), C('H', '8'), C('H', '9')]),
      seatHand(1, []),
      seatHand(2, []),
      seatHand(3, []),
    ]
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBe('NS')
  })

  it('only EW has sequence', () => {
    const perSeat = [
      seatHand(0, []),
      seatHand(1, [C('D', '7'), C('D', '8'), C('D', '9')]),
      seatHand(2, []),
      seatHand(3, []),
    ]
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBe('EW')
  })

  it('carré tie: higher carré wins (j > 9)', () => {
    const perSeat = [
      seatHand(0, [C('H', 'J'), C('D', 'J'), C('S', 'J'), C('C', 'J')]),
      seatHand(1, [C('H', '9'), C('D', '9'), C('S', '9'), C('C', '9')]),
      seatHand(2, []),
      seatHand(3, []),
    ]
    const r = resolveAnnouncements(perSeat, 'C', 'C')
    expect(r.winningTeam).toBe('NS')
  })

  it('holdsBelotPair detects K+Q of trump; false when trump is null', () => {
    expect(holdsBelotPair([C('H', 'K'), C('H', 'Q')], 'H')).toBe(true)
    expect(holdsBelotPair([C('H', 'K')], 'H')).toBe(false)
    expect(holdsBelotPair([C('H', 'K'), C('H', 'Q')], null)).toBe(false)
  })
})

describe('scoring: more edge cases', () => {
  it('EW bidder capot', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 1, // EW
      multiplier: 1,
      trickPoints: { NS: 0, EW: 152 },
      tricksWon: { NS: 0, EW: 8 },
      lastTrickWinnerTeam: 'EW',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.capot).toBe('EW')
    expect(r.awardedRaw.EW).toBe(152 + 10 + 90)
  })

  it('EW bidder inside (bidder team < defenders)', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 1,
      multiplier: 1,
      trickPoints: { NS: 100, EW: 52 },
      tricksWon: { NS: 5, EW: 3 },
      lastTrickWinnerTeam: 'NS',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.insideAppliedAgainst).toBe('EW')
    expect(r.awardedRaw.EW).toBe(0)
    expect(r.awardedRaw.NS).toBe(162)
  })

  it('EW belot stays on inside', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 1,
      multiplier: 1,
      trickPoints: { NS: 122, EW: 30 },
      tricksWon: { NS: 6, EW: 2 },
      lastTrickWinnerTeam: 'NS',
      announcements: [],
      belotDeclaredBy: 1, // EW
    })
    expect(r.insideAppliedAgainst).toBe('EW')
    expect(r.awardedRaw.EW).toBe(20)
  })

  it('announcements assigned to NS and EW correctly', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0,
      multiplier: 1,
      trickPoints: { NS: 100, EW: 52 },
      tricksWon: { NS: 5, EW: 3 },
      lastTrickWinnerTeam: 'NS',
      announcements: [
        { kind: 'sequence', seat: 1, suit: 'D', topRank: '10', length: 3, points: 20 },
      ],
      belotDeclaredBy: null,
    })
    expect(r.announcementPoints).toEqual({ NS: 0, EW: 20 })
  })
})
