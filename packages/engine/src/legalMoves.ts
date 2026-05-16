import type { Card, Contract, Suit, Trick } from '@belot/shared'
import { cardStrength, isTrump } from './ranking.js'

// Returns the subset of `hand` that may legally be played to the given trick under contract rules.
// Rules (Bulgarian belote, per belot.bg):
//   1. Leader may play anything.
//   2. Followers must follow the led suit if they can.
//   3. Suit-trump contract (C/D/H/S): if can't follow, must play trump if held;
//      if a trump was already played, must over-trump if able — UNLESS partner is winning.
//   4. AT (Всичко коз): every suit uses trump values but NO suit dominates another.
//      The led suit is effectively trump-for-this-trick. Must follow if able, and must
//      over-trump WITHIN the led suit when possible (unless partner is winning). If
//      cannot follow → free discard (cross-suit can't win in AT).
//   5. NT (Без коз): no trump; follow if able; otherwise free.
export function legalMoves(
  hand: readonly Card[],
  trick: Trick,
  contract: Contract,
  trump: Suit | null,
): Card[] {
  if (trick.cards.length === 0) return hand.slice()
  const ledSuit = trick.cards[0]!.card.suit

  const followers = hand.filter((c) => c.suit === ledSuit)
  if (contract === 'NT') {
    return followers.length > 0 ? followers : hand.slice()
  }

  // AT: each suit is its own trump. Cross-suit can't take the trick.
  if (contract === 'AT') {
    if (followers.length > 0) {
      // Must follow + over-trump within the led suit (unless partner winning).
      const partnerWinning = isPartnerCurrentlyWinning(trick, contract, trump)
      if (partnerWinning) return followers
      const currentBest = currentWinningStrength(trick, contract, trump)
      const overs = followers.filter((c) => cardStrength(c, contract, trump) > currentBest)
      return overs.length > 0 ? overs : followers
    }
    // Can't follow → free discard. Any card can be thrown; none will win the trick.
    return hand.slice()
  }

  // Suit trump (C/D/H/S).
  if (followers.length > 0) {
    if (ledSuit === trump) {
      // Following trump-on-trump → must over-trump if able (unless partner winning).
      const partnerWinning = isPartnerCurrentlyWinning(trick, contract, trump)
      if (partnerWinning) return followers
      const currentBest = currentWinningStrength(trick, contract, trump)
      const overs = followers.filter((c) => cardStrength(c, contract, trump) > currentBest)
      return overs.length > 0 ? overs : followers
    }
    return followers
  }

  // Cannot follow led suit. Must trump if able; over-trump if a trump was already played AND partner not winning.
  const trumps = hand.filter((c) => isTrump(c, contract, trump))
  if (trumps.length === 0) return hand.slice() // free discard

  const partnerWinning = isPartnerCurrentlyWinning(trick, contract, trump)
  if (partnerWinning) return hand.slice() // may discard freely when partner is winning

  const currentBest = currentWinningStrength(trick, contract, trump)
  const trumpInTrick = trickHasTrump(trick, contract, trump)
  if (trumpInTrick) {
    const overTrumps = trumps.filter((c) => cardStrength(c, contract, trump) > currentBest)
    return overTrumps.length > 0 ? overTrumps : trumps
  }
  return trumps
}

export function isLegalPlay(
  card: Card,
  hand: readonly Card[],
  trick: Trick,
  contract: Contract,
  trump: Suit | null,
): boolean {
  if (!hand.some((c) => c.suit === card.suit && c.rank === card.rank)) return false
  return legalMoves(hand, trick, contract, trump).some(
    (c) => c.suit === card.suit && c.rank === card.rank,
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────
function trickHasTrump(trick: Trick, contract: Contract, trump: Suit | null): boolean {
  return trick.cards.some((p) => isTrump(p.card, contract, trump))
}

function currentTrickWinnerIndex(trick: Trick, contract: Contract, trump: Suit | null): number {
  // Returns index in trick.cards of the currently winning play (0..length-1).
  const ledSuit = trick.cards[0]!.card.suit
  let bestIdx = 0
  let bestStrength = -1

  if (contract === 'AT') {
    // In Всичко коз every suit uses trump values, but NO suit dominates another.
    // The led suit is the only suit that can win this trick.
    trick.cards.forEach((p, i) => {
      if (p.card.suit !== ledSuit) return
      const s = cardStrength(p.card, contract, trump)
      if (s > bestStrength) { bestStrength = s; bestIdx = i }
    })
    return bestIdx
  }

  // Suit trump or NT: if any trump appears, only trumps win; otherwise only led suit.
  const trumpedAtAll = trick.cards.some((p) => isTrump(p.card, contract, trump))
  trick.cards.forEach((p, i) => {
    const isT = isTrump(p.card, contract, trump)
    if (trumpedAtAll && !isT) return
    if (!trumpedAtAll && p.card.suit !== ledSuit) return
    const s = cardStrength(p.card, contract, trump)
    if (s > bestStrength) { bestStrength = s; bestIdx = i }
  })
  return bestIdx
}

function currentWinningStrength(trick: Trick, contract: Contract, trump: Suit | null): number {
  const i = currentTrickWinnerIndex(trick, contract, trump)
  return cardStrength(trick.cards[i]!.card, contract, trump)
}

function isPartnerCurrentlyWinning(trick: Trick, contract: Contract, trump: Suit | null): boolean {
  // "Current actor" is implicitly the next seat to play (trick.cards.length-th seat in play order).
  // Partner of current actor = actor + 2 (mod 4). The leader of the trick + offset gives seat of i-th play.
  const i = currentTrickWinnerIndex(trick, contract, trump)
  const winnerSeat = trick.cards[i]!.seat
  // Number of plays so far = trick.cards.length. Next actor seat:
  const nextActor = (trick.leader + trick.cards.length) % 4
  const partner = (nextActor + 2) % 4
  return winnerSeat === partner
}

export function trickWinner(trick: Trick, contract: Contract, trump: Suit | null): number {
  return trick.cards[currentTrickWinnerIndex(trick, contract, trump)]!.seat
}
