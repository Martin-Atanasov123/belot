import type { Card, Contract, Suit, Trick } from '@belot/shared'
import { cardStrength, isTrump } from './ranking.js'

// Returns the subset of `hand` that may legally be played to the given trick under contract rules.
// Rules (Bulgarian belote, spec §3 "Play Rules"):
//   1. Leader may play anything.
//   2. Followers must follow the led suit if they can.
//   3. In trump contracts (AT, C/D/H/S): if cannot follow suit, must trump if able;
//      if a trump was already played in this trick, must over-trump if possible (надкозване).
//      Exception: if partner is currently winning the trick, may discard (i.e., follow-suit
//      requirement still holds, but over-trump is NOT required when partner already winning).
//   4. In NT: never required to trump (there is no trump). Just follow-suit-if-possible; else free.
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

  // Trump contracts.
  if (followers.length > 0) {
    // Must follow suit. Over-trump rule applies when the led suit IS trump.
    if (ledSuit === trump || contract === 'AT') {
      // Led suit is trump → must rise above the current winning trump if possible.
      const currentBest = currentWinningStrength(trick, contract, trump)
      const overs = followers.filter((c) => cardStrength(c, contract, trump) > currentBest)
      return overs.length > 0 ? overs : followers
    }
    return followers
  }

  // Cannot follow. Must trump if able; over-trump if a trump was already played AND partner is not winning.
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
  const trumpedAtAll = trick.cards.some((p) => isTrump(p.card, contract, trump))
  let bestIdx = 0
  let bestStrength = -1
  trick.cards.forEach((p, i) => {
    const isT = isTrump(p.card, contract, trump)
    // If any trump is in the trick, only trumps can win. Otherwise only led-suit can.
    if (trumpedAtAll && !isT) return
    if (!trumpedAtAll && p.card.suit !== ledSuit) return
    const s = cardStrength(p.card, contract, trump)
    if (s > bestStrength) {
      bestStrength = s
      bestIdx = i
    }
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
