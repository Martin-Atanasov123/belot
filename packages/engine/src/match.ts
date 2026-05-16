import {
  DEFAULT_SETTINGS,
  nextSeat,
  teamOf,
  type Action,
  type Card,
  type GameSnapshot,
  type PlayerView,
  type RoomSettings,
  type Seat,
  type Suit,
  type Trick,
} from '@belot/shared'
import { applyBid, bidLegal, startBidding, type BiddingState } from './bidding.js'
import { dealFromSeed } from './deck.js'
import { isLegalPlay, trickWinner } from './legalMoves.js'
import { mulberry32 } from './rng.js'
import { cardPoints } from './ranking.js'
import { holdsBelotPair, resolveAnnouncements, scanHand } from './announcements.js'
import { scoreHand, toTens } from './scoring.js'

export type EngineError = { error: string }
export const isError = (x: unknown): x is EngineError =>
  typeof x === 'object' && x !== null && 'error' in (x as Record<string, unknown>)

// We embed the live BiddingState inside the snapshot via the public fields the spec exposes.
// To avoid duplicating state, we serialize bidding into snapshot fields and rebuild on demand.
function biddingToSnapshot(b: BiddingState, snap: GameSnapshot): GameSnapshot {
  return {
    ...snap,
    bidHistory: b.history,
    multiplier: b.multiplier,
    passesInARow: b.passesInARow,
    bidsMadeThisHand: b.history.filter((h) => h.type === 'BID').length,
    turn: b.turn,
    bidder: b.currentBid?.seat ?? null,
  }
}

function snapshotToBidding(snap: GameSnapshot): BiddingState {
  const lastBid = [...snap.bidHistory].reverse().find((h) => h.type === 'BID') as
    | { type: 'BID'; seat: Seat; contract: import('@belot/shared').BidContract }
    | undefined
  return {
    history: snap.bidHistory.slice(),
    currentBid: lastBid ? { contract: lastBid.contract, seat: lastBid.seat } : null,
    passesInARow: snap.passesInARow,
    turn: snap.turn,
    multiplier: snap.multiplier,
    firstBidder: nextSeat(snap.dealer),
    dealer: snap.dealer,
    done: snap.phase !== 'BIDDING',
    redeal: false,
    result: snap.contract
      ? {
          contract: snap.contract,
          bidder: snap.bidder!,
          trump: snap.trump,
          multiplier: snap.multiplier,
        }
      : null,
  }
}

export function newMatch(opts: { seed: number; dealer?: Seat; settings?: RoomSettings }): GameSnapshot {
  const dealer: Seat = opts.dealer ?? 3 // so first bidder = 0 (south) by default
  const settings = opts.settings ?? DEFAULT_SETTINGS
  return startNewHand({
    seed: opts.seed,
    dealer,
    settings,
    matchScore: { NS: 0, EW: 0 },
    handNo: 0,
  })
}

function startNewHand(args: {
  seed: number
  dealer: Seat
  settings: RoomSettings
  matchScore: { NS: number; EW: number }
  handNo: number
  hungPool?: { points: number } | null
}): GameSnapshot {
  const rng = mulberry32(args.seed)
  const hands = dealFromSeed(rng, args.dealer)
  const bidding = startBidding(args.dealer, args.settings.enableNT, args.settings.enableAT)
  const snap: GameSnapshot = {
    phase: 'BIDDING',
    dealer: args.dealer,
    turn: bidding.turn,
    hands,
    contract: null,
    trump: null,
    bidder: null,
    multiplier: 1,
    bidHistory: [],
    passesInARow: 0,
    bidsMadeThisHand: 0,
    currentTrick: null,
    completedTricks: [],
    announcements: [],
    belotIntent: null,
    matchScore: args.matchScore,
    handNo: args.handNo + 1,
    settings: args.settings,
    rngSeed: args.seed,
    hungPool: args.hungPool ?? null,
  }
  return snap
}

// Single reducer.
export function apply(snap: GameSnapshot, action: Action): GameSnapshot | EngineError {
  switch (snap.phase) {
    case 'BIDDING':
      return applyBidPhase(snap, action)
    case 'PLAYING':
      return applyPlayPhase(snap, action)
    case 'HAND_OVER':
      // Auto-advance via advanceHand(); apply() rejects further actions.
      return { error: 'hand is over; call advanceHand()' }
    case 'GAME_OVER':
      return { error: 'game is over' }
    default:
      return { error: `cannot apply action in phase ${snap.phase}` }
  }
}

function applyBidPhase(snap: GameSnapshot, action: Action): GameSnapshot | EngineError {
  const b = snapshotToBidding(snap)
  let input: Parameters<typeof bidLegal>[2]
  switch (action.type) {
    case 'PASS': input = { type: 'PASS' }; break
    case 'BID': input = { type: 'BID', contract: action.contract }; break
    case 'CONTRA': input = { type: 'CONTRA' }; break
    case 'RECONTRA': input = { type: 'RECONTRA' }; break
    default: return { error: 'expected a bidding action' }
  }
  const err = bidLegal(b, action.seat as Seat, input, snap.settings)
  if (err) return { error: err }
  const after = applyBid(b, action.seat as Seat, input)
  let next = biddingToSnapshot(after, snap)
  if (after.done) {
    if (after.redeal) {
      // Next dealer redeals; new seed derived deterministically from current.
      return startNewHand({
        seed: snap.rngSeed + 1,
        dealer: nextSeat(snap.dealer),
        settings: snap.settings,
        matchScore: snap.matchScore,
        handNo: snap.handNo - 1, // same hand number after redeal — we incremented when starting; un-increment to keep count
        hungPool: snap.hungPool, // preserve the carry across redeals
      })
    }
    next = {
      ...next,
      phase: 'PLAYING',
      contract: after.result!.contract,
      trump: after.result!.trump,
      bidder: after.result!.bidder,
      multiplier: after.result!.multiplier,
      turn: nextSeat(snap.dealer),
      currentTrick: { leader: nextSeat(snap.dealer), cards: [] },
    }
  }
  return next
}

function applyPlayPhase(snap: GameSnapshot, action: Action): GameSnapshot | EngineError {
  if (action.type === 'BELOT') {
    // Declaration is implicit when the second of K/Q-of-trump is played; the only "BELOT" action
    // accepted here is the announce on play — handled inside PLAY. Standalone BELOT not used.
    return { error: 'belot is announced automatically when the second card is played' }
  }
  if (action.type !== 'PLAY') return { error: 'expected PLAY action' }
  const seat = action.seat as Seat
  if (seat !== snap.turn) return { error: 'not your turn' }
  const hand = snap.hands[seat]
  if (!isLegalPlay(action.card, hand, snap.currentTrick!, snap.contract!, snap.trump)) {
    return { error: 'illegal card' }
  }

  // Remove the card from hand, append to trick.
  const newHand = hand.filter((c) => !(c.suit === action.card.suit && c.rank === action.card.rank))
  const newHands: Record<Seat, Card[]> = { ...snap.hands, [seat]: newHand }
  const trick: Trick = {
    leader: snap.currentTrick!.leader,
    cards: [...snap.currentTrick!.cards, { seat, card: action.card }],
  }

  // Belot tracking: if the played card is K-of-trump or Q-of-trump, and the player also holds
  // (or already played) the other, mark intent / declare.
  let belotIntent = snap.belotIntent
  if (
    snap.trump !== null &&
    action.card.suit === snap.trump &&
    (action.card.rank === 'K' || action.card.rank === 'Q')
  ) {
    const stillInHand = newHand.some(
      (c) =>
        c.suit === snap.trump &&
        ((action.card.rank === 'K' && c.rank === 'Q') || (action.card.rank === 'Q' && c.rank === 'K')),
    )
    if (stillInHand) {
      // First half played — start intent for this seat.
      belotIntent = { seat, played: 1 }
    } else if (belotIntent && belotIntent.seat === seat) {
      // Second half played by same seat → belot completes.
      belotIntent = { seat, played: 2 }
    }
  }

  let next: GameSnapshot = {
    ...snap,
    hands: newHands,
    currentTrick: trick,
    turn: nextSeat(seat),
    belotIntent,
  }

  if (trick.cards.length === 4) {
    // Resolve trick.
    const winnerSeat = trickWinner(trick, snap.contract!, snap.trump) as Seat
    const trickPoints = trick.cards.reduce((s, p) => s + cardPoints(p.card, snap.contract!, snap.trump), 0)
    next = {
      ...next,
      currentTrick: null,
      completedTricks: [
        ...next.completedTricks,
        { leader: trick.leader, cards: trick.cards, winner: winnerSeat, points: trickPoints },
      ],
      turn: winnerSeat,
    }

    // After the first trick, freeze announcements based on the original deal hands.
    // No announcements at all in NT (belot.bg: "При игра на „Без коз" играчите нямат право
    // да обявяват притежаваните от тях комбинации").
    if (
      next.completedTricks.length === 1 &&
      next.announcements.length === 0 &&
      snap.contract !== 'NT'
    ) {
      const perSeat = ([0, 1, 2, 3] as Seat[]).map((s) =>
        scanHand(
          // Use the *original* deal hand: reconstruct by adding back played card for this seat from trick.
          reconstructDealHand(snap, s),
          s,
        ),
      )
      const resolved = resolveAnnouncements(perSeat, snap.contract!, snap.trump)
      next = { ...next, announcements: resolved.announcements }
    }

    // If all 8 tricks played → score hand.
    if (next.completedTricks.length === 8) {
      next = finalizeHand(next)
    } else {
      next = { ...next, currentTrick: { leader: winnerSeat, cards: [] } }
    }
  }

  return next
}

function reconstructDealHand(snap: GameSnapshot, seat: Seat): Card[] {
  // The snapshot we're scanning from is the one BEFORE the current play removed a card,
  // but in flow above we've already updated `snap` to the post-play state. We pass the
  // pre-trick snapshot reference here, so reconstruction = current hand + (this seat's played cards so far).
  const played: Card[] = []
  for (const t of snap.completedTricks) for (const p of t.cards) if (p.seat === seat) played.push(p.card)
  if (snap.currentTrick) for (const p of snap.currentTrick.cards) if (p.seat === seat) played.push(p.card)
  return [...snap.hands[seat], ...played]
}

function finalizeHand(snap: GameSnapshot): GameSnapshot {
  // Aggregate trick points and trick counts per team.
  let cardNS = 0, cardEW = 0, winsNS = 0, winsEW = 0
  let lastTrickWinnerTeam: 'NS' | 'EW' = 'NS'
  snap.completedTricks.forEach((t, i) => {
    const team = teamOf(t.winner as Seat)
    if (team === 'NS') { cardNS += t.points; winsNS++ } else { cardEW += t.points; winsEW++ }
    if (i === snap.completedTricks.length - 1) lastTrickWinnerTeam = team
  })

  const result = scoreHand({
    contract: snap.contract!,
    bidder: snap.bidder!,
    multiplier: snap.multiplier,
    trickPoints: { NS: cardNS, EW: cardEW },
    tricksWon: { NS: winsNS, EW: winsEW },
    lastTrickWinnerTeam,
    announcements: snap.announcements,
    belotDeclaredBy: snap.belotIntent && snap.belotIntent.played === 2 ? snap.belotIntent.seat : null,
  })

  // ── Convert raw → tens (the scoreboard unit per belot.bg). ─────────────────
  let tensNS = toTens(result.awardedRaw.NS)
  let tensEW = toTens(result.awardedRaw.EW)

  // ── Hung-pool ("висяща") handling. ─────────────────────────────────────────
  // If a previous hand was suspended, its bidder's tens carry to whoever wins
  // THIS hand. We award the carry to whichever team scored more this hand.
  // If this hand is *also* suspended, the new bidder's tens are added to the
  // pool and the pool is preserved (defenders still record their own points).
  let nextHungPool: { points: number } | null = null
  const carry = snap.hungPool?.points ?? 0

  if (result.outcome === 'suspended') {
    const winnerThisHand: 'NS' | 'EW' | null =
      tensNS > tensEW ? 'NS' : tensEW > tensNS ? 'EW' : null
    if (winnerThisHand === null) {
      // Even defenders deadlocked — extremely rare. Roll the carry forward.
      nextHungPool = { points: carry + toTens(result.suspendedRaw) }
    } else {
      // Defenders record their own tens. Bidder's suspended tens accumulate with any prior carry.
      nextHungPool = { points: carry + toTens(result.suspendedRaw) }
    }
  } else {
    // Made or inside: the carry pays out to whichever team scored more this hand.
    if (carry > 0) {
      if (tensNS > tensEW) tensNS += carry
      else if (tensEW > tensNS) tensEW += carry
      else nextHungPool = { points: carry } // truly equal — pool survives
    }
  }

  const newScore = {
    NS: snap.matchScore.NS + tensNS,
    EW: snap.matchScore.EW + tensEW,
  }

  // ── End-of-game detection. ─────────────────────────────────────────────────
  // Match ends when one team hits the target AND has strictly more tens than the other.
  // If both reach target same hand, higher wins; if they tie, play continues.
  const target = snap.settings.gameTo
  const someoneReached = newScore.NS >= target || newScore.EW >= target
  const gameOver = someoneReached && newScore.NS !== newScore.EW

  return {
    ...snap,
    phase: gameOver ? 'GAME_OVER' : 'HAND_OVER',
    matchScore: newScore,
    hungPool: nextHungPool,
  }
}

export function advanceHand(snap: GameSnapshot): GameSnapshot | EngineError {
  if (snap.phase !== 'HAND_OVER') return { error: 'no hand to advance' }
  return startNewHand({
    seed: snap.rngSeed + 1,
    dealer: nextSeat(snap.dealer),
    settings: snap.settings,
    matchScore: snap.matchScore,
    handNo: snap.handNo,
    hungPool: snap.hungPool,
  })
}

// Project a snapshot to a per-seat view. NEVER expose other seats' hands.
export function projectView(snap: GameSnapshot, you: Seat): PlayerView {
  const handCounts: Record<Seat, number> = {
    0: snap.hands[0].length,
    1: snap.hands[1].length,
    2: snap.hands[2].length,
    3: snap.hands[3].length,
  }
  const lastTrick =
    snap.completedTricks.length > 0
      ? {
          winner: snap.completedTricks[snap.completedTricks.length - 1]!.winner as Seat,
          cards: snap.completedTricks[snap.completedTricks.length - 1]!.cards,
        }
      : null
  return {
    you,
    phase: snap.phase,
    dealer: snap.dealer,
    turn: snap.turn,
    yourHand: snap.hands[you].slice(),
    handCounts,
    contract: snap.contract,
    trump: snap.trump,
    bidder: snap.bidder,
    multiplier: snap.multiplier,
    bidHistory: snap.bidHistory.slice(),
    currentTrick: snap.currentTrick,
    lastTrick,
    announcements: snap.announcements.slice(),
    matchScore: snap.matchScore,
    handNo: snap.handNo,
    settings: snap.settings,
    hungPool: snap.hungPool,
  }
}

// Convenience: pick a fallback card on turn-timer expiry — lowest-value legal card.
export function autoPickOnTimeout(snap: GameSnapshot): Card | null {
  if (snap.phase !== 'PLAYING') return null
  const seat = snap.turn
  const hand = snap.hands[seat]
  const legal = hand.filter((c) =>
    isLegalPlay(c, hand, snap.currentTrick!, snap.contract!, snap.trump),
  )
  if (legal.length === 0) return null
  legal.sort((a, b) => cardPoints(a, snap.contract!, snap.trump) - cardPoints(b, snap.contract!, snap.trump))
  return legal[0]!
}

export const _suitGuard: Suit = 'C' // type usage to satisfy verbatimModuleSyntax
