import { describe, expect, it } from 'vitest'
import {
  advanceHand,
  apply,
  autoPickOnTimeout,
  hasPendingTrick,
  isError,
  newMatch,
  projectView,
  resolveTrick,
} from '../src/match.js'
import { legalMoves } from '../src/legalMoves.js'
import type { Action, GameSnapshot, Seat } from '@belot/shared'

function play(snap: GameSnapshot, action: Action): GameSnapshot {
  const r = apply(snap, action)
  if (isError(r)) throw new Error(r.error)
  return r
}

function autoBidToAT(snap: GameSnapshot): GameSnapshot {
  // First bidder of the current hand bids AT, the next three pass.
  let s = snap
  const first = s.turn
  s = play(s, { type: 'BID', seat: first, contract: 'AT' })
  for (let i = 1; i <= 3; i++) {
    const seat = ((first + i) % 4) as Seat
    s = play(s, { type: 'PASS', seat })
  }
  return s
}

// Resolve any pending trick (server normally does this after a delay).
function settle(snap: GameSnapshot): GameSnapshot {
  if (!hasPendingTrick(snap)) return snap
  const r = resolveTrick(snap)
  if (isError(r)) throw new Error(r.error)
  return r
}

function playLowestUntilHandOver(snap: GameSnapshot): GameSnapshot {
  let s = settle(snap)
  let guard = 0
  while (s.phase === 'PLAYING') {
    const card = autoPickOnTimeout(s)
    if (!card) {
      // Pending trick? Resolve and continue.
      if (hasPendingTrick(s)) { s = settle(s); continue }
      throw new Error('no auto card')
    }
    s = play(s, { type: 'PLAY', seat: s.turn, card })
    s = settle(s)
    if (guard++ > 100) throw new Error('infinite loop')
  }
  return s
}

describe('match reducer', () => {
  it('plays a full hand from seed → ends in HAND_OVER or GAME_OVER with finite scores', () => {
    // Use a very high gameTo so the match doesn't end on this single hand by accident.
    let snap = newMatch({
      seed: 12345,
      settings: { ...newMatch({ seed: 0 }).settings, gameTo: 10_000 },
    })
    expect(snap.phase).toBe('BIDDING')
    snap = autoBidToAT(snap)
    expect(snap.phase).toBe('PLAYING')
    snap = playLowestUntilHandOver(snap)
    expect(snap.phase).toBe('HAND_OVER')
    const total = snap.matchScore.NS + snap.matchScore.EW
    expect(total).toBeGreaterThan(0)
    expect(snap.completedTricks).toHaveLength(8)
  })

  it('full hand from a fixed seed produces deterministic score', () => {
    const runOnce = () => {
      let s = newMatch({ seed: 99, settings: { ...newMatch({ seed: 0 }).settings, gameTo: 10_000 } })
      s = autoBidToAT(s)
      s = playLowestUntilHandOver(s)
      return s.matchScore
    }
    expect(runOnce()).toEqual(runOnce())
  })

  it('advanceHand rotates dealer and starts new hand', () => {
    let snap = newMatch({
      seed: 7,
      dealer: 3,
      settings: { ...newMatch({ seed: 0 }).settings, gameTo: 10_000 },
    })
    snap = autoBidToAT(snap)
    snap = playLowestUntilHandOver(snap)
    expect(snap.phase).toBe('HAND_OVER')
    const next = apply(snap, { type: 'PASS', seat: 0 }) // wrong phase
    expect(isError(next)).toBe(true)
    const adv = advanceHand(snap)
    if (isError(adv)) throw new Error(adv.error)
    expect(adv.dealer).toBe(0) // rotated from 3 → 0
    expect(adv.phase).toBe('BIDDING')
    expect(adv.handNo).toBe(2)
  })

  it('match ends when threshold reached', () => {
    let snap = newMatch({ seed: 1, settings: { ...newMatch({ seed: 1 }).settings, gameTo: 50 } })
    let guard = 0
    while (snap.phase !== 'GAME_OVER' && guard++ < 30) {
      snap = autoBidToAT(snap)
      if (snap.phase === 'BIDDING') continue // redeal (4 passes); skip
      snap = playLowestUntilHandOver(snap)
      if (snap.phase === 'HAND_OVER') {
        const adv = advanceHand(snap)
        if (isError(adv)) throw new Error(adv.error)
        snap = adv
      }
    }
    expect(snap.phase).toBe('GAME_OVER')
  })

  it('rejects illegal cards', () => {
    let snap = newMatch({ seed: 4 })
    snap = autoBidToAT(snap)
    const seat = snap.turn
    const notInHand = ([0, 1, 2, 3] as Seat[])
      .filter((s) => s !== seat)
      .flatMap((s) => snap.hands[s])[0]!
    const r = apply(snap, { type: 'PLAY', seat, card: notInHand })
    expect(isError(r)).toBe(true)
  })

  it('rejects acting out of turn', () => {
    let snap = newMatch({ seed: 4 })
    snap = autoBidToAT(snap)
    const wrong = ((snap.turn + 1) % 4) as Seat
    const card = snap.hands[wrong][0]!
    const r = apply(snap, { type: 'PLAY', seat: wrong, card })
    expect(isError(r)).toBe(true)
  })

  it('legal-move enforcement holds for every play in a full hand', () => {
    let snap = newMatch({ seed: 555 })
    snap = autoBidToAT(snap)
    while (snap.phase === 'PLAYING') {
      if (hasPendingTrick(snap)) { snap = settle(snap); continue }
      const seat = snap.turn
      const legal = legalMoves(snap.hands[seat], snap.currentTrick!, snap.contract!, snap.trump)
      expect(legal.length).toBeGreaterThan(0)
      snap = play(snap, { type: 'PLAY', seat, card: legal[0]! })
    }
  })
})

describe('PlayerView anti-cheat', () => {
  it('never reveals other seats hands', () => {
    let snap = newMatch({ seed: 31337 })
    snap = autoBidToAT(snap)
    const view = projectView(snap, 0)
    // own hand present
    expect(view.yourHand).toEqual(snap.hands[0])
    // other hands NOT present anywhere in the view; only counts
    expect(view.handCounts[1]).toBe(snap.hands[1].length)
    const serialized = JSON.stringify(view)
    // none of the other seats' cards should appear by content
    for (const otherSeat of [1, 2, 3] as Seat[]) {
      for (const card of snap.hands[otherSeat]) {
        const occurrencesInOwn = snap.hands[0].filter(
          (c) => c.suit === card.suit && c.rank === card.rank,
        ).length
        const occurrencesInJson = (
          serialized.match(new RegExp(`"suit":"${card.suit}","rank":"${card.rank}"`, 'g')) ?? []
        ).length
        // accept duplicates only if the card is also in own hand (impossible, but safe)
        expect(occurrencesInJson).toBeLessThanOrEqual(occurrencesInOwn)
      }
    }
  })

  it('autoPickOnTimeout returns a legal card', () => {
    let snap = newMatch({ seed: 8 })
    snap = autoBidToAT(snap)
    const card = autoPickOnTimeout(snap)
    expect(card).not.toBeNull()
    const legal = legalMoves(snap.hands[snap.turn], snap.currentTrick!, snap.contract!, snap.trump)
    expect(legal.some((c) => c.suit === card!.suit && c.rank === card!.rank)).toBe(true)
  })
})
