import {
  advanceHand,
  apply,
  autoPickOnTimeout,
  hasPendingTrick,
  isError,
  newMatch,
  projectView,
  resolveTrick,
} from '@belot/engine'
import {
  bidRank,
  DEFAULT_SETTINGS,
  type Action,
  type BidContract,
  type Card,
  type GameSnapshot,
  type PlayerView,
  type RoomSettings,
  type Seat,
  type Suit,
} from '@belot/shared'

export type SeatOccupant = {
  playerId: string // server-assigned secret token
  nickname: string
  connected: boolean
  isBot: boolean
}

export type Room = {
  code: string
  hostId: string
  settings: RoomSettings
  seats: Record<Seat, SeatOccupant | null>
  snapshot: GameSnapshot | null
  createdAt: number
  turnTimer: NodeJS.Timeout | null
  emptyTimer: NodeJS.Timeout | null
  botTimer: NodeJS.Timeout | null
  trickResolveTimer: NodeJS.Timeout | null
}

export function noOccupantsConnected(room: Room): boolean {
  for (const s of [0, 1, 2, 3] as Seat[]) {
    const occ = room.seats[s]
    if (occ && occ.connected) return false
  }
  return true
}

export type PublicRoomState = {
  code: string
  hostId: string
  seats: Array<{ seat: Seat; nickname: string | null; connected: boolean; isBot: boolean }>
  inGame: boolean
  settings: RoomSettings
}

export function createRoom(code: string, hostId: string, settings: Partial<RoomSettings> = {}): Room {
  return {
    code,
    hostId,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    seats: { 0: null, 1: null, 2: null, 3: null },
    snapshot: null,
    createdAt: Date.now(),
    turnTimer: null,
    emptyTimer: null,
    botTimer: null,
    trickResolveTimer: null,
  }
}

export function publicState(room: Room): PublicRoomState {
  return {
    code: room.code,
    hostId: room.hostId,
    seats: ([0, 1, 2, 3] as Seat[]).map((s) => ({
      seat: s,
      nickname: room.seats[s]?.nickname ?? null,
      connected: room.seats[s]?.connected ?? false,
      isBot: room.seats[s]?.isBot ?? false,
    })),
    inGame: room.snapshot !== null,
    settings: room.settings,
  }
}

export function findSeatByPlayerId(room: Room, playerId: string): Seat | null {
  for (const s of [0, 1, 2, 3] as Seat[]) {
    if (room.seats[s]?.playerId === playerId) return s
  }
  return null
}

export function findFreeSeat(room: Room): Seat | null {
  for (const s of [0, 1, 2, 3] as Seat[]) {
    if (!room.seats[s]) return s
  }
  return null
}

export function takeSeat(
  room: Room,
  seat: Seat,
  playerId: string,
  nickname: string,
): { ok: true } | { ok: false; error: string } {
  if (room.snapshot) return { ok: false, error: 'game already in progress' }
  if (room.seats[seat]) return { ok: false, error: 'seat taken' }
  // If this playerId already holds another seat, free it.
  const existing = findSeatByPlayerId(room, playerId)
  if (existing !== null) room.seats[existing] = null
  room.seats[seat] = { playerId, nickname, connected: true, isBot: false }
  return { ok: true }
}

export function addBot(
  room: Room,
  seat: Seat,
  nickname: string,
): { ok: true; playerId: string } | { ok: false; error: string } {
  if (room.snapshot) return { ok: false, error: 'game already in progress' }
  if (room.seats[seat]) return { ok: false, error: 'seat taken' }
  const playerId = `bot-${room.code}-${seat}-${Math.random().toString(36).slice(2, 8)}`
  room.seats[seat] = { playerId, nickname, connected: true, isBot: true }
  return { ok: true, playerId }
}

export function removeBots(room: Room) {
  for (const s of [0, 1, 2, 3] as Seat[]) {
    if (room.seats[s]?.isBot) room.seats[s] = null
  }
}

export function setConnected(room: Room, playerId: string, connected: boolean) {
  const seat = findSeatByPlayerId(room, playerId)
  if (seat === null) return
  room.seats[seat]!.connected = connected
}

export function allSeatsFilled(room: Room): boolean {
  return ([0, 1, 2, 3] as Seat[]).every((s) => room.seats[s] !== null)
}

export function startGame(room: Room): { ok: true } | { ok: false; error: string } {
  if (!allSeatsFilled(room)) return { ok: false, error: 'not all seats filled' }
  if (room.snapshot) return { ok: false, error: 'already started' }
  const seed = Math.floor(Math.random() * 2 ** 31)
  room.snapshot = newMatch({ seed, settings: room.settings })
  return { ok: true }
}

export function applyAction(
  room: Room,
  playerId: string,
  action: Action,
): { ok: true } | { ok: false; error: string } {
  if (!room.snapshot) return { ok: false, error: 'no game in progress' }
  const seat = findSeatByPlayerId(room, playerId)
  if (seat === null) return { ok: false, error: 'not seated' }
  if (action.seat !== seat) return { ok: false, error: 'seat mismatch' }
  const result = apply(room.snapshot, action)
  if (isError(result)) return { ok: false, error: result.error }
  room.snapshot = result
  // Auto-advance HAND_OVER → next BIDDING (we don't wait for player input between hands for MVP)
  if (room.snapshot.phase === 'HAND_OVER') {
    const next = advanceHand(room.snapshot)
    if (!isError(next)) room.snapshot = next
  }
  return { ok: true }
}

export function snapshotForSeat(room: Room, seat: Seat): PlayerView | null {
  if (!room.snapshot) return null
  return projectView(room.snapshot, seat)
}

// Returns the currently-acting seat and an auto-played card for timer expiry.
export function autoPlay(
  room: Room,
): { seat: Seat; action: Action } | null {
  if (!room.snapshot) return null
  if (room.snapshot.phase === 'BIDDING') {
    return { seat: room.snapshot.turn, action: { type: 'PASS', seat: room.snapshot.turn } }
  }
  if (room.snapshot.phase === 'PLAYING') {
    const card = autoPickOnTimeout(room.snapshot)
    if (!card) return null
    return { seat: room.snapshot.turn, action: { type: 'PLAY', seat: room.snapshot.turn, card } }
  }
  return null
}

export function clearTimer(room: Room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer)
    room.turnTimer = null
  }
}

export function clearBotTimer(room: Room) {
  if (room.botTimer) {
    clearTimeout(room.botTimer)
    room.botTimer = null
  }
}

export function clearTrickResolveTimer(room: Room) {
  if (room.trickResolveTimer) {
    clearTimeout(room.trickResolveTimer)
    room.trickResolveTimer = null
  }
}

// Run engine.resolveTrick on the room's snapshot, swap it in, and (best-effort)
// auto-advance HAND_OVER → next hand. Returns true if state changed.
export function resolveCurrentTrick(room: Room): boolean {
  if (!room.snapshot) return false
  if (!hasPendingTrick(room.snapshot)) return false
  const res = resolveTrick(room.snapshot)
  if (isError(res)) return false
  room.snapshot = res
  if (room.snapshot.phase === 'HAND_OVER') {
    const next = advanceHand(room.snapshot)
    if (!isError(next)) room.snapshot = next
  }
  return true
}

export function trickIsPending(room: Room): boolean {
  return !!room.snapshot && hasPendingTrick(room.snapshot)
}

export function isBotsTurn(room: Room): boolean {
  if (!room.snapshot) return false
  const occ = room.seats[room.snapshot.turn]
  return !!occ?.isBot
}

// ── Bot bidding heuristic ──────────────────────────────────────────────
// Score what each potential contract would yield with the seat's 5-card hand.
// Higher = stronger. The thresholds below decide whether to bid or pass.

const TRUMP_VAL: Record<string, number> = {
  J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0,
}
const PLAIN_VAL: Record<string, number> = {
  A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0,
}

function evalContract(hand: readonly Card[], contract: BidContract): number {
  // Crude evaluation: point value of the hand if this contract were played.
  // Adds a bonus for length in the trump suit (so 4+ of a suit is preferred for that suit's bid).
  if (contract === 'NT') {
    return hand.reduce((s, c) => s + (PLAIN_VAL[c.rank] ?? 0), 0)
  }
  if (contract === 'AT') {
    return hand.reduce((s, c) => s + (TRUMP_VAL[c.rank] ?? 0), 0)
  }
  // Suit trump (C/D/H/S):
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
  // Length bonus: 4+ trump = +6, 5 trump = +12.
  if (lengthInTrump >= 5) score += 12
  else if (lengthInTrump >= 4) score += 6
  return score
}

function lastBidContract(history: GameSnapshot['bidHistory']): BidContract | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]!
    if (h.type === 'BID') return h.contract
  }
  return null
}

// Decide a bidding action for the bot whose turn it is.
function decideBotBid(room: Room): Action {
  const snap = room.snapshot!
  const seat = snap.turn
  const passAction: Action = { type: 'PASS', seat }
  const hand = snap.hands[seat]
  const settings = snap.settings

  // Allowed contracts at this point: must be strictly higher than current bid.
  const last = lastBidContract(snap.bidHistory)
  const minIdx = last ? bidRank(last) + 1 : 0
  const options: BidContract[] = (['C', 'D', 'H', 'S', 'NT', 'AT'] as BidContract[])
    .slice(minIdx)
    .filter((c) => (c !== 'NT' || settings.enableNT) && (c !== 'AT' || settings.enableAT))

  if (options.length === 0) return passAction

  // Score every option; pick the strongest.
  const scored = options.map((c) => ({ c, s: evalContract(hand, c) }))
  scored.sort((a, b) => b.s - a.s)
  const best = scored[0]!

  // Thresholds — keep them generous so bots actually bid (5-card hand max ≈ 60-70).
  // Suit bid: need ≥ 36 (e.g. J + 9 + couple of A/10s of side suits, plus length bonus).
  // NT:      need ≥ 50.
  // AT:      need ≥ 55.
  let threshold = 36
  if (best.c === 'NT') threshold = 50
  if (best.c === 'AT') threshold = 55

  // If someone has already bid, raising is risky — require a higher margin.
  if (last) threshold += 6

  if (best.s >= threshold) {
    return { type: 'BID', seat, contract: best.c }
  }

  // Contra: if opponents have bid and our defending hand is strong, threaten contra.
  // Cheap heuristic: 2+ Jacks AND 1+ Ace, against an opponent's bid.
  if (last && snap.multiplier === 1) {
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
        if (jacks >= 2 && aces >= 1) {
          return { type: 'CONTRA', seat }
        }
      }
    }
  }

  return passAction
}

// Bot policy: smart bidding during BIDDING; lowest-value legal card during play.
export function botAction(room: Room): { seat: Seat; action: Action } | null {
  if (!room.snapshot) return null
  if (room.snapshot.phase === 'BIDDING') {
    return { seat: room.snapshot.turn, action: decideBotBid(room) }
  }
  if (room.snapshot.phase === 'PLAYING') {
    const card = autoPickOnTimeout(room.snapshot)
    if (!card) return null
    return { seat: room.snapshot.turn, action: { type: 'PLAY', seat: room.snapshot.turn, card } }
  }
  return null
}
