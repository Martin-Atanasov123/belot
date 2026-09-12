// Pure bot decision helpers. Extracted from server/room.ts so the client can
// also use them for offline solo-vs-bots play. Same rules, same difficulty
// tuning — one source of truth for how bots think.

import {
  bidRank,
  type Action,
  type BidContract,
  type Card,
  type GameSnapshot,
  type Seat,
  type Suit,
} from '@belot/shared'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

// Card-value tables used by bid evaluation. Match packages/engine/src/ranking.ts
// (trump valuation for the 8 ranks, non-trump valuation for the remaining suits).
const TRUMP_VAL: Record<string, number> = {
  J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0,
}
const PLAIN_VAL: Record<string, number> = {
  A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0,
}

// Score what each potential contract would yield with the seat's 5-card hand.
// Higher = stronger. Callers use it to pick the best bid option.
export function evalContract(hand: readonly Card[], contract: BidContract): number {
  if (contract === 'NT') {
    return hand.reduce((s, c) => s + (PLAIN_VAL[c.rank] ?? 0), 0)
  }
  if (contract === 'AT') {
    return hand.reduce((s, c) => s + (TRUMP_VAL[c.rank] ?? 0), 0)
  }
  const trumpSuit = contract as Suit
  let score = 0
  let lengthInTrump = 0
  for (const c of hand) {
    if (c.suit === trumpSuit) {
      score += TRUMP_VAL[c.rank] ?? 0
      lengthInTrump += 1
    } else {
      score += PLAIN_VAL[c.rank] ?? 0
    }
  }
  if (lengthInTrump >= 5) score += 12
  else if (lengthInTrump >= 4) score += 6
  return score
}

// Most recent live bid (skipping PASS / CONTRA / RECONTRA), or null when the
// auction is still open.
export function lastBidContract(history: GameSnapshot['bidHistory']): BidContract | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!
    if (h.type === 'BID') return h.contract
  }
  return null
}

// Decide a bidding action for the bot whose turn it is. Deterministic given
// snap.rngSeed + seat, so replays are bit-exact. Handles:
//   - only-legal bids (must be strictly higher than current, respects
//     enableNT/enableAT settings)
//   - difficulty tuning (easy ≈ timid, hard ≈ aggressive)
//   - a small deterministic wobble so bots aren't perfectly predictable
//   - contra when the defending hand is strong enough (medium+ only)
export function pickBotBid(snap: GameSnapshot, difficulty: BotDifficulty = 'medium'): Action {
  const seat = snap.turn
  const passAction: Action = { type: 'PASS', seat }
  const hand = snap.hands[seat]
  const settings = snap.settings

  const last = lastBidContract(snap.bidHistory)
  const minIdx = last ? bidRank(last) + 1 : 0
  const options: BidContract[] = (['C', 'D', 'H', 'S', 'NT', 'AT'] as BidContract[])
    .slice(minIdx)
    .filter((c) => (c !== 'NT' || settings.enableNT) && (c !== 'AT' || settings.enableAT))

  if (options.length === 0) return passAction

  const scored = options.map((c) => ({ c, s: evalContract(hand, c) }))
  scored.sort((a, b) => b.s - a.s)
  const best = scored[0]!

  let threshold = 40
  if (best.c === 'NT') threshold = 54
  if (best.c === 'AT') threshold = 58

  if (difficulty === 'easy') threshold += 12
  else if (difficulty === 'hard') threshold -= 6

  if (last) threshold += 8

  const wobbleSeed = (snap.rngSeed ^ (seat * 7919)) >>> 0
  const wobble = ((wobbleSeed % 9) - 4)
  const effectiveScore = best.s + wobble

  const passDie = (wobbleSeed >>> 4) % 100
  const occasionallyPass = passDie < 10

  if (effectiveScore >= threshold && !occasionallyPass) {
    return { type: 'BID', seat, contract: best.c }
  }

  // Contra check — only medium+ difficulty threatens contra.
  if (last && snap.multiplier === 1 && difficulty !== 'easy') {
    let lastBidSeat: Seat | null = null
    for (let i = snap.bidHistory.length - 1; i >= 0; i--) {
      const h = snap.bidHistory[i]!
      if (h.type === 'BID') { lastBidSeat = h.seat; break }
    }
    if (lastBidSeat !== null) {
      const lastTeam = (lastBidSeat === 0 || lastBidSeat === 2) ? 'NS' : 'EW'
      const myTeam = (seat === 0 || seat === 2) ? 'NS' : 'EW'
      if (lastTeam !== myTeam) {
        const jacks = hand.filter((c) => c.rank === 'J').length
        const aces = hand.filter((c) => c.rank === 'A').length
        const tens = hand.filter((c) => c.rank === '10').length
        if (jacks >= 2 && (aces + tens) >= 2) {
          return { type: 'CONTRA', seat }
        }
      }
    }
  }

  return passAction
}
