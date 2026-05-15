import { describe, expect, it } from 'vitest'
import { scoreHand } from '../src/scoring.js'

describe('scoring', () => {
  it('normal made hand: bidder team gets their points', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0, // NS
      multiplier: 1,
      trickPoints: { NS: 90, EW: 62 },
      tricksWon: { NS: 5, EW: 3 },
      lastTrickWinnerTeam: 'NS',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.cardPoints).toEqual({ NS: 100, EW: 62 }) // +10 last trick
    expect(r.awarded).toEqual({ NS: 100, EW: 62 })
    expect(r.insideAppliedAgainst).toBeNull()
  })

  it('inside: bidder ≤ defenders → defenders take everything (belot stays)', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0, // NS
      multiplier: 1,
      trickPoints: { NS: 50, EW: 102 },
      tricksWon: { NS: 3, EW: 5 },
      lastTrickWinnerTeam: 'EW',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.insideAppliedAgainst).toBe('NS')
    // Defenders get 152 + 10 = 162 total. NS gets 0.
    expect(r.awarded.NS).toBe(0)
    expect(r.awarded.EW).toBe(162)
  })

  it('капо: winning all 8 tricks adds +90', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0,
      multiplier: 1,
      trickPoints: { NS: 152, EW: 0 },
      tricksWon: { NS: 8, EW: 0 },
      lastTrickWinnerTeam: 'NS',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.capot).toBe('NS')
    expect(r.awarded.NS).toBe(152 + 10 + 90)
  })

  it('contra doubles awarded points', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0,
      multiplier: 2,
      trickPoints: { NS: 100, EW: 52 },
      tricksWon: { NS: 5, EW: 3 },
      lastTrickWinnerTeam: 'NS',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.awarded.NS).toBe((100 + 10) * 2)
    expect(r.awarded.EW).toBe(52 * 2)
  })

  it('re-contra ×4', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0,
      multiplier: 4,
      trickPoints: { NS: 100, EW: 52 },
      tricksWon: { NS: 5, EW: 3 },
      lastTrickWinnerTeam: 'NS',
      announcements: [],
      belotDeclaredBy: null,
    })
    expect(r.awarded.NS).toBe((100 + 10) * 4)
  })

  it('NT doubles card and announcement points', () => {
    const r = scoreHand({
      contract: 'NT',
      bidder: 0,
      multiplier: 1,
      trickPoints: { NS: 80, EW: 40 },
      tricksWon: { NS: 5, EW: 3 },
      lastTrickWinnerTeam: 'NS',
      announcements: [{ kind: 'sequence', seat: 0, suit: 'H', topRank: '10', length: 3, points: 20 }],
      belotDeclaredBy: null,
    })
    // card: NS 80+10 = 90 → ×2 = 180. EW 40 → ×2 = 80.
    // ann: NS 20 → ×2 = 40. Bidder total = 220, defenders = 80 → make.
    expect(r.awarded.NS).toBe(180 + 40)
    expect(r.awarded.EW).toBe(80)
  })

  it('belot stays with declarer even on inside', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0,
      multiplier: 1,
      trickPoints: { NS: 30, EW: 122 },
      tricksWon: { NS: 2, EW: 6 },
      lastTrickWinnerTeam: 'EW',
      announcements: [],
      belotDeclaredBy: 0, // NS player declared belot
    })
    // Bidder NS total = 30 + 0 + 20(belot) = 50; def EW = 122+10 = 132. NS inside.
    expect(r.insideAppliedAgainst).toBe('NS')
    expect(r.awarded.NS).toBe(20) // belot kept
    expect(r.awarded.EW).toBe(132 + 30) // takes bidder cards (30); belot stays with NS
  })

  it('exactly tied scores → bidder inside (defenders win)', () => {
    const r = scoreHand({
      contract: 'H',
      bidder: 0,
      multiplier: 1,
      trickPoints: { NS: 76, EW: 76 },
      tricksWon: { NS: 4, EW: 4 },
      lastTrickWinnerTeam: 'EW',
      announcements: [],
      belotDeclaredBy: null,
    })
    // NS=76, EW=86 → bidder NS already loses by raw card points.
    expect(r.insideAppliedAgainst).toBe('NS')
    expect(r.awarded.NS).toBe(0)
  })
})
