import { randomBytes } from 'node:crypto'
import {
  advanceHand,
  apply,
  autoPickOnTimeout,
  hasPendingTrick,
  pickBotBid,
  pickBotCard,
  isError,
  newMatch,
  projectSpectatorView,
  projectView,
  resolveTrick,
} from '@belot/engine'
import {
  DEFAULT_SETTINGS,
  type Action,
  type GameSnapshot,
  type PlayerView,
  type RoomSettings,
  type Seat,
} from '@belot/shared'

export type SeatOccupant = {
  playerId: string // server-assigned secret token
  nickname: string
  connected: boolean
  isBot: boolean
  // Verified Supabase auth uid when the seat is held by a signed-in user; null
  // for guests and bots. Used for server-authoritative match persistence so a
  // seat id can only ever be a real, JWT-verified profile id (never a guest UUID).
  userId: string | null
  // Random per-seat reconnect secret minted on first join. A guest must present
  // it to reclaim this seat (prevents seat takeover via a leaked playerId, SEC-004).
  // Authed users reclaim via their JWT instead, so this is irrelevant for them.
  reconnectToken: string | null
  lastReactionAt?: number // ms timestamp; used to rate-limit emote spam
}

export type Spectator = {
  playerId: string
  nickname: string
}

export type Room = {
  code: string
  hostId: string
  settings: RoomSettings
  seats: Record<Seat, SeatOccupant | null>
  spectators: Map<string, Spectator>
  snapshot: GameSnapshot | null
  createdAt: number
  turnTimer: NodeJS.Timeout | null
  emptyTimer: NodeJS.Timeout | null
  botTimer: NodeJS.Timeout | null
  trickResolveTimer: NodeJS.Timeout | null
  // When true, the room auto-starts the game once all 4 seats are filled and
  // every human is connected. Used by matchmaking-created rooms so players
  // don't have to click "Start" after landing in the room.
  autoStartOnFill: boolean
  // Set once the finished match has been persisted to the DB, so a GAME_OVER
  // state that gets re-broadcast doesn't write the row more than once.
  persisted: boolean
  // Quick-match (public) room: players land in the lobby and vote to add bots;
  // a fallback timer fills them after a wait. Private rooms (created by a host
  // via "Частна стая") have isQuickMatch=false and are controlled by the host.
  isQuickMatch: boolean
  // Seats that have voted to fill the empty seats with bots (quick-match only).
  botVotes: Set<Seat>
  // Fallback timer that auto-fills bots + starts a quick-match room after a wait.
  quickFillTimer: NodeJS.Timeout | null
}

export function noOccupantsConnected(room: Room): boolean {
  // A room is "empty" when no humans are connected. Bots alone don't keep a
  // room alive — without humans, the cleanup timer should fire.
  for (const s of [0, 1, 2, 3] as Seat[]) {
    const occ = room.seats[s]
    if (occ && !occ.isBot && occ.connected) return false
  }
  // If a spectator is still hanging out, keep the room alive too.
  if (room.spectators.size > 0) return false
  return true
}

// True if at least one seated, connected, non-bot human is present. When this
// is false the table is effectively abandoned (only bots remain) — we stop the
// bots and don't count the result, since no real player is playing it out.
export function anyHumanConnected(room: Room): boolean {
  for (const s of [0, 1, 2, 3] as Seat[]) {
    const occ = room.seats[s]
    if (occ && !occ.isBot && occ.connected) return true
  }
  return false
}

// True when every seat is filled AND every human in it is connected (bots
// always count as connected). Used by matchmaking's auto-start trigger.
export function everyoneConnected(room: Room): boolean {
  return ([0, 1, 2, 3] as Seat[]).every((s) => {
    const occ = room.seats[s]
    return !!occ && (occ.isBot || occ.connected)
  })
}

export type PublicRoomState = {
  code: string
  hostId: string
  seats: Array<{ seat: Seat; nickname: string | null; connected: boolean; isBot: boolean }>
  inGame: boolean
  settings: RoomSettings
  spectatorCount: number
  isQuickMatch: boolean
  botVotes: number
  botVoteThreshold: number
}

export function createRoom(code: string, hostId: string, settings: Partial<RoomSettings> = {}): Room {
  return {
    code,
    hostId,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    seats: { 0: null, 1: null, 2: null, 3: null },
    snapshot: null,
    spectators: new Map(),
    createdAt: Date.now(),
    turnTimer: null,
    emptyTimer: null,
    botTimer: null,
    trickResolveTimer: null,
    autoStartOnFill: false,
    persisted: false,
    isQuickMatch: false,
    botVotes: new Set<Seat>(),
    quickFillTimer: null,
  }
}

// How many seats are held by humans (connected or not — they hold the seat).
export function seatedHumanCount(room: Room): number {
  let n = 0
  for (const s of [0, 1, 2, 3] as Seat[]) {
    const o = room.seats[s]
    if (o && !o.isBot) n++
  }
  return n
}

// Majority of the humans currently at the table.
export function botVoteThreshold(room: Room): number {
  const h = seatedHumanCount(room)
  return h <= 1 ? 1 : Math.floor(h / 2) + 1
}

// Votes that still come from a seat currently held by a human (drops votes from
// players who left).
export function botVoteCount(room: Room): number {
  let n = 0
  for (const s of room.botVotes) {
    const o = room.seats[s]
    if (o && !o.isBot) n++
  }
  return n
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
    spectatorCount: room.spectators.size,
    isQuickMatch: room.isQuickMatch,
    botVotes: botVoteCount(room),
    botVoteThreshold: botVoteThreshold(room),
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
  userId: string | null = null,
): { ok: true; reconnectToken: string } | { ok: false; error: string } {
  if (room.snapshot) return { ok: false, error: 'game already in progress' }
  if (room.seats[seat]) return { ok: false, error: 'seat taken' }
  // If this playerId already holds another seat, free it.
  const existing = findSeatByPlayerId(room, playerId)
  if (existing !== null) room.seats[existing] = null
  const reconnectToken = randomBytes(16).toString('hex')
  room.seats[seat] = { playerId, nickname, connected: true, isBot: false, userId, reconnectToken }
  return { ok: true, reconnectToken }
}

export function addBot(
  room: Room,
  seat: Seat,
  nickname: string,
): { ok: true; playerId: string } | { ok: false; error: string } {
  if (room.snapshot) return { ok: false, error: 'game already in progress' }
  if (room.seats[seat]) return { ok: false, error: 'seat taken' }
  const playerId = `bot-${room.code}-${seat}-${randomBytes(6).toString('hex')}`
  room.seats[seat] = { playerId, nickname, connected: true, isBot: true, userId: null, reconnectToken: null }
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
  const seed = randomBytes(4).readUInt32BE(0)
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

export function snapshotForSpectator(room: Room): PlayerView | null {
  if (!room.snapshot) return null
  return projectSpectatorView(room.snapshot)
}

export function addSpectator(room: Room, playerId: string, nickname: string) {
  room.spectators.set(playerId, { playerId, nickname })
}

export function removeSpectator(room: Room, playerId: string) {
  room.spectators.delete(playerId)
}

export function isSpectator(room: Room, playerId: string): boolean {
  return room.spectators.has(playerId)
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

// Bot policy: smart bidding during BIDDING (engine helper), difficulty-tuned
// card play during PLAYING. Both helpers are pure engine functions so the
// client's offline solo-vs-bots mode uses the exact same logic.
export function botAction(room: Room): { seat: Seat; action: Action } | null {
  if (!room.snapshot) return null
  if (room.snapshot.phase === 'BIDDING') {
    return { seat: room.snapshot.turn, action: pickBotBid(room.snapshot, room.settings.botDifficulty) }
  }
  if (room.snapshot.phase === 'PLAYING') {
    // Difficulty-tuned card picker (engine helper). Falls back to the lowest
    // legal card if for any reason the heuristic returns nothing or throws.
    let card: import('@belot/shared').Card | null = null
    try {
      card = pickBotCard(room.snapshot, room.settings.botDifficulty)
    } catch {
      // Heuristic failed — fall through to the safe fallback below.
    }
    card = card ?? autoPickOnTimeout(room.snapshot)
    if (!card) return null
    return { seat: room.snapshot.turn, action: { type: 'PLAY', seat: room.snapshot.turn, card } }
  }
  return null
}
