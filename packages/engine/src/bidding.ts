import {
  BID_CONTRACTS,
  bidRank,
  nextSeat,
  type BidContract,
  type BidHistoryEntry,
  type Contract,
  type Multiplier,
  type Seat,
  type Suit,
  teamOf,
} from '@belot/shared'

export type BiddingState = {
  history: BidHistoryEntry[]
  currentBid: { contract: BidContract; seat: Seat } | null
  passesInARow: number
  turn: Seat
  multiplier: Multiplier
  firstBidder: Seat // dealer + 1
  dealer: Seat
  done: boolean
  redeal: boolean // true if 4 passes before any bid → next dealer redeals
  result: {
    contract: Contract
    bidder: Seat
    trump: Suit | null
    multiplier: Multiplier
  } | null
}

export function startBidding(dealer: Seat, enableNT = true, enableAT = true): BiddingState {
  void enableNT
  void enableAT
  return {
    history: [],
    currentBid: null,
    passesInARow: 0,
    turn: nextSeat(dealer),
    multiplier: 1,
    firstBidder: nextSeat(dealer),
    dealer,
    done: false,
    redeal: false,
    result: null,
  }
}

export type BidInput =
  | { type: 'PASS' }
  | { type: 'BID'; contract: BidContract }
  | { type: 'CONTRA' }
  | { type: 'RECONTRA' }

export function bidLegal(state: BiddingState, seat: Seat, input: BidInput, settings: { enableNT: boolean; enableAT: boolean }): string | null {
  if (state.done) return 'bidding is over'
  if (seat !== state.turn) return 'not your turn'
  if (input.type === 'PASS') return null
  if (input.type === 'BID') {
    if (!settings.enableNT && input.contract === 'NT') return 'NT disabled'
    if (!settings.enableAT && input.contract === 'AT') return 'AT disabled'
    if (state.currentBid && bidRank(input.contract) <= bidRank(state.currentBid.contract)) {
      return 'bid must be higher than current'
    }
    return null
  }
  if (input.type === 'CONTRA') {
    if (!state.currentBid) return 'nothing to contra'
    if (state.multiplier !== 1) return 'already contra-d'
    if (teamOf(seat) === teamOf(state.currentBid.seat)) return 'cannot contra your own team'
    return null
  }
  if (input.type === 'RECONTRA') {
    if (!state.currentBid) return 'nothing to re-contra'
    if (state.multiplier !== 2) return 'no contra in play'
    if (teamOf(seat) !== teamOf(state.currentBid.seat)) return 'only bidder team can re-contra'
    return null
  }
  return 'unknown input'
}

export function applyBid(state: BiddingState, seat: Seat, input: BidInput): BiddingState {
  const next: BiddingState = {
    ...state,
    history: state.history.slice(),
    currentBid: state.currentBid,
  }

  switch (input.type) {
    case 'PASS': {
      next.history.push({ type: 'PASS', seat })
      next.passesInARow = state.passesInARow + 1
      break
    }
    case 'BID': {
      next.history.push({ type: 'BID', seat, contract: input.contract })
      next.currentBid = { contract: input.contract, seat }
      next.passesInARow = 0
      next.multiplier = 1 // any new bid resets contra
      break
    }
    case 'CONTRA': {
      next.history.push({ type: 'CONTRA', seat })
      next.multiplier = 2
      next.passesInARow = 0
      break
    }
    case 'RECONTRA': {
      next.history.push({ type: 'RECONTRA', seat })
      next.multiplier = 4
      next.passesInARow = 0
      break
    }
  }

  // Termination rules
  if (!next.currentBid && next.passesInARow >= 4) {
    next.done = true
    next.redeal = true
    next.turn = state.turn // unchanged
    return next
  }
  if (next.currentBid && next.passesInARow >= 3) {
    next.done = true
    const { contract, seat: bidderSeat } = next.currentBid
    next.result = {
      contract,
      bidder: bidderSeat,
      trump: contract === 'NT' || contract === 'AT' ? null : (contract as Suit),
      multiplier: next.multiplier,
    }
    return next
  }

  next.turn = nextSeat(state.turn)
  return next
}

export const _BID_CONTRACTS = BID_CONTRACTS
