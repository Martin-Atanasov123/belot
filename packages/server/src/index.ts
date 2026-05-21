import 'dotenv/config'
import Fastify, { type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import { Server as SocketIOServer } from 'socket.io'
import { customAlphabet } from 'nanoid'
import { z } from 'zod'
import {
  persistMatchRow,
  reportTournamentWinner,
  verifyAccessToken,
  type AuthedUser,
} from './supabase.js'
import {
  ActionSchema,
  teamOf,
  type PlayerView,
  type Seat,
} from '@belot/shared'
import {
  addBot,
  addSpectator,
  allSeatsFilled,
  applyAction,
  autoPlay,
  botAction,
  clearBotTimer,
  clearTimer,
  clearTrickResolveTimer,
  createRoom,
  everyoneConnected,
  findFreeSeat,
  findSeatByPlayerId,
  isBotsTurn,
  isSpectator,
  noOccupantsConnected,
  publicState,
  removeSpectator,
  resolveCurrentTrick,
  setConnected,
  snapshotForSeat,
  snapshotForSpectator,
  startGame,
  takeSeat,
  trickIsPending,
  type Room,
} from './room.js'
import type { Socket } from 'socket.io'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'

// ── Capacity ceilings (SEC-005 / SEC-006) ────────────────────────────────────
const MAX_ROOMS = 5_000        // global in-memory room cap
const MAX_SPECTATORS = 50      // per room
const MAX_ROOMS_PER_USER = 20  // active rooms a single authed user may host

// ── Fail-fast env validation ─────────────────────────────────────────────────
// In production, refuse to boot with an invalid config rather than silently
// degrading (e.g. PORT NaN, or a wildcard CORS origin that browsers reject).
function validateEnv(): void {
  if (Number.isNaN(PORT) || PORT <= 0) {
    throw new Error(`invalid PORT: ${process.env.PORT}`)
  }
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN must be set in production (comma-separated origins)')
  }
}
validateEnv()

// ── CORS origins ─────────────────────────────────────────────────────────────
// Wildcards are NEVER allowed when credentials:true — browsers reject them.
// Production origins must be listed in CORS_ORIGIN env var (comma-separated).
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
]

function buildCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN
  if (!raw) return DEV_ORIGINS
  const listed = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (listed.includes('*')) {
    console.warn(
      '[cors] CORS_ORIGIN contains wildcard — credentials:true requires explicit origins. ' +
      'Falling back to localhost-only. Set CORS_ORIGIN to your production domain.',
    )
    return DEV_ORIGINS
  }
  return [...new Set([...listed, ...DEV_ORIGINS])]
}

const CORS_ORIGINS = buildCorsOrigins()

// ── Nickname sanitization ────────────────────────────────────────────────────
// Strip HTML-special chars and C0 control characters before the nickname is
// stored in room state and broadcast to all connected clients.
function sanitizeNickname(raw: string): string {
  return raw
    .replace(/[<>&"'/]/g, '')          // HTML injection vectors
    .replace(/[\x00-\x1F\x7F]/g, '')  // C0 control chars + DEL
    .trim()
    .slice(0, 20)
}

// ── IP-based rate limiters ───────────────────────────────────────────────────
type IpBucket = { count: number; resetAt: number }

function makeIpLimiter(maxPerWindow: number, windowMs: number) {
  const buckets = new Map<string, IpBucket>()
  let lastPrune = 0

  return function allow(ip: string): boolean {
    const now = Date.now()
    // Lazy prune every 5 min to prevent unbounded growth.
    if (now - lastPrune > 5 * 60_000) {
      lastPrune = now
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k)
    }
    let b = buckets.get(ip)
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + windowMs }
    }
    if (b.count >= maxPerWindow) return false
    b.count++
    buckets.set(ip, b)
    return true
  }
}

const allowRoomCreate = makeIpLimiter(10, 10 * 60_000)   // 10 rooms / 10 min
const allowRoomLookup = makeIpLimiter(60, 60_000)         // 60 lookups / min

// ── Per-socket sliding-window rate limiter ───────────────────────────────────
function checkRateLimit(timestamps: number[], maxCalls: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  while (timestamps.length > 0 && timestamps[0]! < cutoff) timestamps.shift()
  if (timestamps.length >= maxCalls) return false
  timestamps.push(now)
  return true
}

// ── JWT extraction from HTTP request header ──────────────────────────────────
async function getAuthedUserFromRequest(req: FastifyRequest): Promise<AuthedUser | null> {
  const auth = req.headers.authorization
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null
  return verifyAccessToken(auth.slice(7))
}

const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

const rooms = new Map<string, Room>()

// Enforce the global room ceiling: if at capacity, evict the oldest empty room
// (clearing its timers). Returns false if there's no room to make. (SEC-006)
function ensureRoomCapacity(): boolean {
  if (rooms.size < MAX_ROOMS) return true
  let oldest: Room | null = null
  for (const r of rooms.values()) {
    if (!noOccupantsConnected(r)) continue
    if (!oldest || r.createdAt < oldest.createdAt) oldest = r
  }
  if (!oldest) return false
  clearTimer(oldest)
  clearBotTimer(oldest)
  clearTrickResolveTimer(oldest)
  if (oldest.emptyTimer) clearTimeout(oldest.emptyTimer)
  rooms.delete(oldest.code)
  return true
}

// Count rooms a given authed user currently hosts (per-user cap, SEC-006).
function countRoomsHostedBy(userId: string): number {
  let n = 0
  for (const r of rooms.values()) if (r.hostId === userId) n++
  return n
}

const app = Fastify({
  trustProxy: true,     // respect X-Forwarded-For from Render/Netlify reverse proxy
  bodyLimit: 64 * 1024, // 64 KB — plenty for our small JSON bodies
  logger:
    process.env.NODE_ENV === 'production'
      ? true
      : { transport: { target: 'pino-pretty' } },
})

await app.register(cors, {
  origin: CORS_ORIGINS, // explicit list — never `true` with credentials:true
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Security headers on every response. This is a JSON/WebSocket API (it serves
// no HTML), so the set is intentionally lean: nosniff, deny framing, referrer
// policy, and HSTS in production. No CSP needed — no markup is served.
app.addHook('onSend', async (req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'no-referrer')
  reply.header('Cross-Origin-Resource-Policy', 'same-site')
  if (process.env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})

// Minimal health check — no internal state exposed.
app.get('/health', async () => ({ ok: true }))

const CreateRoomBody = z.object({ hostId: z.string().min(1) })
app.post('/rooms', async (req, reply) => {
  if (!allowRoomCreate(req.ip)) {
    return reply.code(429).send({ error: 'too many rooms — try again later' })
  }
  const body = CreateRoomBody.safeParse(req.body)
  if (!body.success) return reply.code(400).send({ error: 'invalid body' })

  // Verify JWT from Authorization header. If valid, use the confirmed user ID
  // as hostId — ignores the client body to prevent identity spoofing.
  const authedUser = await getAuthedUserFromRequest(req)
  const hostId = authedUser?.id ?? body.data.hostId

  // Per-user cap: stop a single account from hoarding rooms (SEC-006).
  if (authedUser && countRoomsHostedBy(authedUser.id) >= MAX_ROOMS_PER_USER) {
    return reply.code(429).send({ error: 'too many active rooms for this account' })
  }
  if (!ensureRoomCapacity()) {
    return reply.code(503).send({ error: 'server at capacity — try again shortly' })
  }

  const code = roomCode()
  const room = createRoom(code, hostId)
  rooms.set(code, room)
  return { code, state: publicState(room) }
})

app.get('/rooms/:code', async (req, reply) => {
  if (!allowRoomLookup(req.ip)) {
    return reply.code(429).send({ error: 'too many lookups' })
  }
  const params = z.object({ code: z.string() }).parse(req.params)
  const room = rooms.get(params.code.toUpperCase())
  if (!room) return reply.code(404).send({ error: 'room not found' })
  return publicState(room)
})

// List joinable / spectatable public rooms. Excludes matchmaking rooms (autoStartOnFill).
app.get('/rooms', async (req, reply) => {
  if (!allowRoomLookup(req.ip)) {
    return reply.code(429).send({ error: 'too many requests' })
  }
  const list = [...rooms.values()]
    .filter((r) => {
      if (r.autoStartOnFill) return false
      return ([0, 1, 2, 3] as Seat[]).some((s) => {
        const occ = r.seats[s]
        return !!occ && !occ.isBot && occ.connected
      })
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20)
    .map(publicState)
  return list
})

const server = app.server
const io = new SocketIOServer(server, {
  cors: { origin: CORS_ORIGINS, credentials: true },
  // Compress large payloads (PlayerView with hand history can exceed 2 KB).
  // level 1 = fastest compression; threshold 1 KB avoids overhead on tiny acks.
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 1 },
    zlibInflateOptions: { chunkSize: 10 * 1024 },
  },
})

// Optional auth middleware. The client passes the Supabase JWT in the
// `auth.token` field of the Socket.IO handshake. If it verifies, we attach
// the authed user to `socket.data.user`. If it doesn't, we still let the
// connection through — guests are first-class citizens.
io.use(async (socket, next) => {
  const raw = (socket.handshake.auth as { token?: string } | undefined)?.token
  if (typeof raw === 'string' && raw.length > 0) {
    const user = await verifyAccessToken(raw)
    ;(socket.data as { user?: AuthedUser | null }).user = user
  } else {
    ;(socket.data as { user?: AuthedUser | null }).user = null
  }
  next()
})

const TURN_TIMER_MS = 30_000
const ROOM_EMPTY_GRACE_MS = 60_000
const BOT_TURN_DELAY_MS = 750
const TRICK_LINGER_MS = 1500

function cancelEmptyTimer(room: Room) {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer)
    room.emptyTimer = null
  }
}

function scheduleEmptyTimer(room: Room) {
  if (room.emptyTimer) return
  room.emptyTimer = setTimeout(() => {
    if (!noOccupantsConnected(room)) return
    // Clear ALL timers to prevent leaks when the room is deleted.
    clearTimer(room)
    clearBotTimer(room)
    clearTrickResolveTimer(room)
    rooms.delete(room.code)
    app.log.info({ code: room.code }, 'deleted empty room')
  }, ROOM_EMPTY_GRACE_MS)
}

function broadcastRoomState(room: Room) {
  io.to(`room:${room.code}`).emit('room:state', publicState(room))
}

function broadcastViews(room: Room) {
  if (!room.snapshot) return
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const occ = room.seats[seat]
    if (!occ) continue
    // Bots have no socket listening — skip the projection + emit entirely.
    // In a solo-vs-3-bots game this drops 3 projectView() calls per action.
    if (occ.isBot) continue
    const view: PlayerView = snapshotForSeat(room, seat)!
    io.to(`player:${occ.playerId}`).emit('game:view', view)
  }
  // Spectators share one public projection — broadcast to the spectator channel
  // rather than looping through each spectator individually (O(1) instead of O(n)).
  if (room.spectators.size > 0) {
    const view = snapshotForSpectator(room)
    if (view) {
      io.to(`spectators:${room.code}`).emit('game:view', view)
    }
  }
}

function armTurnTimer(room: Room) {
  clearTimer(room)
  if (!room.snapshot) return
  if (room.snapshot.phase !== 'BIDDING' && room.snapshot.phase !== 'PLAYING') return
  if (isBotsTurn(room)) return
  room.turnTimer = setTimeout(() => {
    const pick = autoPlay(room)
    if (!pick) return
    const occ = room.seats[pick.seat]
    if (!occ) return
    applyAction(room, occ.playerId, pick.action)
    afterTransition(room)
  }, TURN_TIMER_MS)
}

function maybeScheduleBotTurn(room: Room) {
  clearBotTimer(room)
  if (!room.snapshot) return
  if (!isBotsTurn(room)) return
  room.botTimer = setTimeout(() => {
    if (!isBotsTurn(room)) return
    const pick = botAction(room)
    if (!pick) return
    const occ = room.seats[pick.seat]
    if (!occ) return
    const r = applyAction(room, occ.playerId, pick.action)
    if (!r.ok) {
      app.log.warn({ code: room.code, err: r.error }, 'bot action failed')
      return
    }
    afterTransition(room)
  }, BOT_TURN_DELAY_MS)
}

// Persist a finished match to the DB, server-authoritatively (SEC-001/SEC-002).
// Runs once per room (guarded by room.persisted). Only records games that had at
// least one signed-in player, so the matches table stays meaningful.
function maybePersistMatch(room: Room): void {
  if (room.persisted) return
  if (!room.snapshot || room.snapshot.phase !== 'GAME_OVER') return
  room.persisted = true

  const uid = (s: Seat) => room.seats[s]?.userId ?? null
  const name = (s: Seat) => room.seats[s]?.nickname ?? null
  const anyAuthed = ([0, 1, 2, 3] as Seat[]).some((s) => uid(s) !== null)
  if (!anyAuthed) return // guest/bot-only game — nothing worth recording

  const score = room.snapshot.matchScore
  const winnerTeam: 'NS' | 'EW' = score.NS >= score.EW ? 'NS' : 'EW'
  const startedAt = new Date(room.createdAt).toISOString()
  const code = room.code

  // Which tournament participant (if any) is on the winning team → server-set winner.
  const winnerUidForTournament = ([0, 1, 2, 3] as Seat[])
    .filter((s) => teamOf(s) === winnerTeam)
    .map((s) => uid(s))
    .find((id): id is string => id !== null)

  void (async () => {
    const matchId = await persistMatchRow({
      roomCode: code,
      seatIds: { n: uid(2), e: uid(3), s: uid(0), w: uid(1) },
      seatNames: { n: name(2), e: name(3), s: name(0), w: name(1) },
      scoreNS: score.NS,
      scoreEW: score.EW,
      winnerTeam,
      handCount: room.snapshot!.handHistory.length || 1,
      settings: room.settings,
      summary: { handHistory: room.snapshot!.handHistory },
      startedAt,
    })
    if (winnerUidForTournament) {
      await reportTournamentWinner(code, matchId, winnerUidForTournament)
    }
  })().catch((err) => app.log.warn({ code, err: String(err) }, 'match persist failed'))
}

function afterTransition(room: Room) {
  broadcastRoomState(room)
  broadcastViews(room)
  maybePersistMatch(room)

  if (trickIsPending(room)) {
    clearTimer(room)
    clearBotTimer(room)
    clearTrickResolveTimer(room)
    room.trickResolveTimer = setTimeout(() => {
      const changed = resolveCurrentTrick(room)
      if (changed) afterTransition(room)
    }, TRICK_LINGER_MS)
    return
  }

  if (isBotsTurn(room)) {
    clearTimer(room)
    maybeScheduleBotTurn(room)
  } else {
    clearBotTimer(room)
    armTurnTimer(room)
  }
}

// ── Matchmaking (Quick Play) ─────────────────────────────────────────────────
// FIFO queue. Every MM_PAIRING_INTERVAL_MS the loop:
//   1) Groups every 4 waiting players into a fresh auto-start room.
//   2) Falls back to a bot-filled room for anyone waiting > MM_BOT_FILL_AFTER_MS.
// The room's autoStartOnFill flag makes the game start automatically once
// all 4 humans (or the lone human + 3 bots) have landed in the room.

type MMEntry = {
  socket: Socket
  playerId: string
  nickname: string
  joinedAt: number
}

const MM_PAIRING_INTERVAL_MS = 2_000
const MM_BOT_FILL_AFTER_MS   = 30_000
const MM_GROUP_SIZE          = 4

const mmQueue = new Map<string, MMEntry>() // keyed by socket.id

function leaveMMQueue(socketId: string): void {
  mmQueue.delete(socketId)
}

function startMatchmakingRoom(group: MMEntry[]): void {
  if (!ensureRoomCapacity()) return // leave the group queued; retry next tick
  const code = roomCode()
  const host = group[0]!
  const room = createRoom(code, host.playerId)
  room.autoStartOnFill = true
  rooms.set(code, room)
  // Schedule cleanup if no one actually joins (e.g. closed tab between match
  // notification and navigation). cancelEmptyTimer fires inside room:join.
  scheduleEmptyTimer(room)

  for (const e of group) {
    mmQueue.delete(e.socket.id)
    e.socket.emit('mm:matched', { code, withBots: false })
  }
  app.log.info({ code, players: group.length }, 'matchmaking: room created (humans)')
}

function startMatchmakingRoomWithBots(entry: MMEntry): void {
  if (!ensureRoomCapacity()) return // retry next tick
  const code = roomCode()
  const room = createRoom(code, entry.playerId)
  room.autoStartOnFill = true
  rooms.set(code, room)
  // Three bots pre-seated; the human takes seat 0 when they join.
  addBot(room, 1, 'Bot 1')
  addBot(room, 2, 'Bot 2')
  addBot(room, 3, 'Bot 3')
  scheduleEmptyTimer(room)

  mmQueue.delete(entry.socket.id)
  entry.socket.emit('mm:matched', { code, withBots: true })
  app.log.info({ code }, 'matchmaking: room created (bot fill)')
}

function processMatchmaking(): void {
  if (mmQueue.size === 0) return
  // Drop disconnected sockets defensively.
  for (const [id, e] of mmQueue) if (!e.socket.connected) mmQueue.delete(id)
  if (mmQueue.size === 0) return

  // Oldest-first ordering.
  const entries = [...mmQueue.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  // Group of 4
  while (entries.length >= MM_GROUP_SIZE) {
    const group = entries.splice(0, MM_GROUP_SIZE)
    startMatchmakingRoom(group)
  }
  // Bot fallback
  const now = Date.now()
  for (const entry of entries) {
    if (now - entry.joinedAt >= MM_BOT_FILL_AFTER_MS) {
      startMatchmakingRoomWithBots(entry)
    }
  }
}

setInterval(processMatchmaking, MM_PAIRING_INTERVAL_MS).unref()

io.on('connection', (socket) => {
  let joinedRoom: string | null = null
  let playerId: string | null = null

  // Per-socket sliding-window rate-limiter state.
  const rl = {
    gameAction:   [] as number[], // max 20 / 2 s
    joinSpectate: [] as number[], // max 5  / 10 s  (shared: join + spectate + auth:refresh)
  }

  // Authenticated sockets must use their JWT user ID as playerId. Read fresh
  // from socket.data so a late sign-in (applied via auth:refresh) is honored
  // for subsequent events rather than frozen at connection time (SEC-007).
  const currentUser = (): AuthedUser | null =>
    (socket.data as { user?: AuthedUser | null }).user ?? null

  // ── auth:refresh ────────────────────────────────────────────────────────────
  // Clients should emit this whenever Supabase silently refreshes their token
  // (typically every hour). The server updates its socket-level identity cache.
  socket.on('auth:refresh', async (raw, cb: (resp: unknown) => void) => {
    if (!checkRateLimit(rl.joinSpectate, 5, 10_000)) {
      return cb({ ok: false, error: 'too fast' })
    }
    const parsed = z.object({ token: z.string().min(1) }).safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })

    const user = await verifyAccessToken(parsed.data.token)
    if (!user) return cb({ ok: false, error: 'invalid or expired token' })

    // Guard: an authenticated socket cannot switch to a different user identity.
    const current = (socket.data as { user?: AuthedUser | null }).user
    if (current && current.id !== user.id) {
      return cb({ ok: false, error: 'identity mismatch' })
    }
    ;(socket.data as { user?: AuthedUser | null }).user = user
    cb({ ok: true })
  })

  // ── mm:join / mm:leave (Quick Play) ──────────────────────────────────────────
  socket.on('mm:join', (raw, cb: (resp: unknown) => void) => {
    if (!checkRateLimit(rl.joinSpectate, 5, 10_000)) {
      return cb({ ok: false, error: 'too fast' })
    }
    const parsed = z
      .object({
        playerId: z.string().min(1),
        nickname: z.string().min(1).max(20),
      })
      .safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })

    if (mmQueue.has(socket.id)) return cb({ ok: false, error: 'already in queue' })

    const resolvedPlayerId = currentUser()?.id ?? parsed.data.playerId
    const safeNickname = sanitizeNickname(parsed.data.nickname) || 'Player'
    mmQueue.set(socket.id, {
      socket,
      playerId: resolvedPlayerId,
      nickname: safeNickname,
      joinedAt: Date.now(),
    })
    cb({ ok: true })
  })

  socket.on('mm:leave', (_raw, cb: (resp: unknown) => void) => {
    leaveMMQueue(socket.id)
    cb({ ok: true })
  })

  // ── room:join ────────────────────────────────────────────────────────────────
  socket.on('room:join', (raw, cb: (resp: unknown) => void) => {
    if (!checkRateLimit(rl.joinSpectate, 5, 10_000)) {
      return cb({ ok: false, error: 'too many join attempts' })
    }
    const parsed = z
      .object({
        code: z.string(),
        playerId: z.string().min(1),
        nickname: z.string().min(1).max(20),
        seat: z.number().int().min(0).max(3).optional(),
        // Guest reconnect secret returned by a prior join (SEC-004). Authed
        // users don't need it — their JWT is the proof of identity.
        seatToken: z.string().optional(),
      })
      .safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })

    // Authenticated users: always use verified JWT uid — prevents seat takeover.
    const user = currentUser()
    const resolvedPlayerId = user?.id ?? parsed.data.playerId
    const safeNickname = sanitizeNickname(parsed.data.nickname) || 'Player'

    const room = rooms.get(parsed.data.code.toUpperCase())
    if (!room) return cb({ ok: false, error: 'room not found' })

    const existingSeat = findSeatByPlayerId(room, resolvedPlayerId)
    let seat: Seat | null = existingSeat
    if (seat === null) {
      const requested = parsed.data.seat
      seat = requested !== undefined && room.seats[requested as Seat] === null
        ? (requested as Seat)
        : findFreeSeat(room)
      if (seat === null) return cb({ ok: false, error: 'room full' })
      const take = takeSeat(room, seat, resolvedPlayerId, safeNickname, user?.id ?? null)
      if (!take.ok) return cb({ ok: false, error: take.error })
    } else {
      // Reclaiming an existing seat. An authed user proves identity via JWT.
      // A guest must present the reconnect token minted on first join — this
      // stops anyone who merely learns a victim's playerId from hijacking the
      // seat (SEC-004).
      const occ = room.seats[seat]!
      const authedMatch = !!user && occ.userId === user.id
      if (!authedMatch && occ.reconnectToken && parsed.data.seatToken !== occ.reconnectToken) {
        return cb({ ok: false, error: 'reconnect token required' })
      }
      setConnected(room, resolvedPlayerId, true)
    }

    joinedRoom = room.code
    playerId = resolvedPlayerId
    socket.join(`room:${room.code}`)
    socket.join(`player:${playerId}`)
    cancelEmptyTimer(room)

    const seatToken = seat !== null ? room.seats[seat]?.reconnectToken ?? null : null
    cb({ ok: true, seat, state: publicState(room), seatToken })
    broadcastRoomState(room)
    if (room.snapshot) broadcastViews(room)

    // Matchmaking auto-start: when this fills the room, kick the game off
    // without waiting for anyone to click "Start".
    if (
      room.autoStartOnFill &&
      !room.snapshot &&
      allSeatsFilled(room) &&
      everyoneConnected(room)
    ) {
      room.autoStartOnFill = false // once
      const r = startGame(room)
      if (r.ok) afterTransition(room)
    }
  })

  // ── room:start ───────────────────────────────────────────────────────────────
  socket.on('room:start', (_raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    if (room.hostId !== playerId) {
      return cb({ ok: false, error: 'only the host can start the game' })
    }
    if (!allSeatsFilled(room)) return cb({ ok: false, error: 'fill all 4 seats first' })
    const r = startGame(room)
    if (!r.ok) return cb({ ok: false, error: r.error })
    cb({ ok: true })
    afterTransition(room)
  })

  // ── room:react ───────────────────────────────────────────────────────────────
  const ALLOWED_REACTIONS = ['👏', '🤔', '😂', '🔥', '🙏', '😴'] as const
  socket.on('room:react', (raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    const seat = findSeatByPlayerId(room, playerId)
    if (seat === null) return cb({ ok: false, error: 'spectators cannot react' })
    const parsed = z
      .object({ emote: z.enum(ALLOWED_REACTIONS as unknown as [string, ...string[]]) })
      .safeParse(raw ?? {})
    if (!parsed.success) return cb({ ok: false, error: 'invalid emote' })

    const now = Date.now()
    const occ = room.seats[seat]!
    if (occ.lastReactionAt && now - occ.lastReactionAt < 1500) {
      return cb({ ok: false, error: 'too fast' })
    }
    occ.lastReactionAt = now

    cb({ ok: true })
    io.to(`room:${room.code}`).emit('room:reaction', { seat, emote: parsed.data.emote, ts: now })
  })

  // ── room:spectate ────────────────────────────────────────────────────────────
  socket.on('room:spectate', (raw, cb: (resp: unknown) => void) => {
    if (!checkRateLimit(rl.joinSpectate, 5, 10_000)) {
      return cb({ ok: false, error: 'too many join attempts' })
    }
    const parsed = z
      .object({
        code: z.string(),
        playerId: z.string().min(1),
        nickname: z.string().min(1).max(20),
      })
      .safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })

    const resolvedPlayerId = currentUser()?.id ?? parsed.data.playerId
    const safeNickname = sanitizeNickname(parsed.data.nickname) || 'Spectator'

    const room = rooms.get(parsed.data.code.toUpperCase())
    if (!room) return cb({ ok: false, error: 'room not found' })

    if (findSeatByPlayerId(room, resolvedPlayerId) !== null) {
      return cb({ ok: false, error: 'already seated' })
    }
    // Cap spectators per room to bound memory + broadcast amplification (SEC-005).
    // An existing spectator re-subscribing (same id) is allowed through.
    if (!isSpectator(room, resolvedPlayerId) && room.spectators.size >= MAX_SPECTATORS) {
      return cb({ ok: false, error: 'spectator limit reached' })
    }
    addSpectator(room, resolvedPlayerId, safeNickname)
    joinedRoom = room.code
    playerId = resolvedPlayerId
    socket.join(`room:${room.code}`)
    socket.join(`player:${playerId}`)
    // Join the shared spectator broadcast channel for efficient game view delivery.
    socket.join(`spectators:${room.code}`)
    cancelEmptyTimer(room)

    cb({ ok: true, state: publicState(room) })
    broadcastRoomState(room)
    if (room.snapshot) {
      const view = snapshotForSpectator(room)
      if (view) socket.emit('game:view', view)
    }
  })

  // ── room:setSettings ─────────────────────────────────────────────────────────
  socket.on('room:setSettings', (raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    if (room.snapshot) return cb({ ok: false, error: 'game already in progress' })
    if (room.hostId !== playerId) return cb({ ok: false, error: 'only host can change settings' })
    const parsed = z
      .object({
        capotDoubledByContra: z.boolean().optional(),
        enableNT: z.boolean().optional(),
        enableAT: z.boolean().optional(),
      })
      .safeParse(raw ?? {})
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })
    const next = { ...room.settings }
    if (parsed.data.capotDoubledByContra !== undefined) next.capotDoubledByContra = parsed.data.capotDoubledByContra
    if (parsed.data.enableNT !== undefined) next.enableNT = parsed.data.enableNT
    if (parsed.data.enableAT !== undefined) next.enableAT = parsed.data.enableAT
    room.settings = next
    cb({ ok: true })
    broadcastRoomState(room)
  })

  // ── room:addBot ──────────────────────────────────────────────────────────────
  socket.on('room:addBot', (raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    if (room.hostId !== playerId) {
      return cb({ ok: false, error: 'only the host can add bots' })
    }
    if (room.snapshot) return cb({ ok: false, error: 'game already in progress' })
    const parsed = z
      .object({ seat: z.number().int().min(0).max(3).optional() })
      .safeParse(raw ?? {})
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })
    const seat: Seat | null =
      parsed.data.seat !== undefined && room.seats[parsed.data.seat as Seat] === null
        ? (parsed.data.seat as Seat)
        : findFreeSeat(room)
    if (seat === null) return cb({ ok: false, error: 'no free seat' })
    const botCount =
      ([0, 1, 2, 3] as Seat[]).filter((s) => room.seats[s]?.isBot).length + 1
    const result = addBot(room, seat, `Bot ${botCount}`)
    if (!result.ok) return cb({ ok: false, error: result.error })
    cb({ ok: true, seat })
    broadcastRoomState(room)
  })

  // ── game:action ──────────────────────────────────────────────────────────────
  socket.on('game:action', (raw, cb: (resp: unknown) => void) => {
    if (!checkRateLimit(rl.gameAction, 20, 2_000)) {
      return cb({ ok: false, error: 'too fast' })
    }
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    const parsed = ActionSchema.safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid action' })
    const r = applyAction(room, playerId, parsed.data)
    if (!r.ok) return cb({ ok: false, error: r.error })
    cb({ ok: true })
    afterTransition(room)
  })

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    // Drop from matchmaking queue if they were waiting.
    leaveMMQueue(socket.id)

    if (!joinedRoom || !playerId) return
    const room = rooms.get(joinedRoom)
    if (!room) return
    if (isSpectator(room, playerId)) {
      removeSpectator(room, playerId)
    } else {
      setConnected(room, playerId, false)
    }
    broadcastRoomState(room)
    if (noOccupantsConnected(room)) scheduleEmptyTimer(room)
  })
})

await app.listen({ port: PORT, host: HOST })
app.log.info(`belot server listening on ${HOST}:${PORT}`)

// ── Graceful shutdown ────────────────────────────────────────────────────────
// Drain every room's timers, close Socket.IO and the HTTP server, then exit.
// Prevents dangling timers / half-open sockets on SIGTERM (Render) or SIGINT.
let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info({ signal }, 'shutting down — draining timers')
  for (const room of rooms.values()) {
    clearTimer(room)
    clearBotTimer(room)
    clearTrickResolveTimer(room)
    if (room.emptyTimer) clearTimeout(room.emptyTimer)
  }
  rooms.clear()
  try {
    await new Promise<void>((resolve) => io.close(() => resolve()))
    await app.close()
  } catch (err) {
    app.log.warn({ err: String(err) }, 'error during shutdown')
  } finally {
    process.exit(0)
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
