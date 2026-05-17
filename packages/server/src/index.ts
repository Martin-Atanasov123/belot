import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server as SocketIOServer } from 'socket.io'
import { customAlphabet } from 'nanoid'
import { z } from 'zod'
import {
  ActionSchema,
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

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const CORS_ORIGIN = [
  ...(process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim()),
  // Always allow local dev origins so the production server can be tested from localhost.
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
]

const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

const rooms = new Map<string, Room>()

const app = Fastify({
  logger:
    process.env.NODE_ENV === 'production'
      ? true
      : { transport: { target: 'pino-pretty' } },
})

await app.register(cors, {
  origin: CORS_ORIGIN.includes('*') ? true : CORS_ORIGIN,
  credentials: true,
})

app.get('/health', async () => ({ ok: true, rooms: rooms.size }))

const CreateRoomBody = z.object({
  hostId: z.string().min(1),
})
app.post('/rooms', async (req, reply) => {
  const body = CreateRoomBody.safeParse(req.body)
  if (!body.success) return reply.code(400).send({ error: 'invalid body' })
  const code = roomCode()
  const room = createRoom(code, body.data.hostId)
  rooms.set(code, room)
  return { code, state: publicState(room) }
})

app.get('/rooms/:code', async (req, reply) => {
  const params = z.object({ code: z.string() }).parse(req.params)
  const room = rooms.get(params.code.toUpperCase())
  if (!room) return reply.code(404).send({ error: 'room not found' })
  return publicState(room)
})

const server = app.server
const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN.includes('*') ? true : CORS_ORIGIN,
    credentials: true,
  },
})

const TURN_TIMER_MS = 30_000
const ROOM_EMPTY_GRACE_MS = 60_000 // delete a room 60s after all sockets disconnect
const BOT_TURN_DELAY_MS = 750     // pacing for bot moves so it feels human
const TRICK_LINGER_MS = 1500      // hold a completed trick on the table this long before collecting

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
    clearTimer(room)
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
    const view: PlayerView = snapshotForSeat(room, seat)!
    io.to(`player:${occ.playerId}`).emit('game:view', view)
  }
  // Spectators get the public projection — never any seat's hand.
  if (room.spectators.size > 0) {
    const view = snapshotForSpectator(room)
    if (view) {
      for (const sp of room.spectators.values()) {
        io.to(`player:${sp.playerId}`).emit('game:view', view)
      }
    }
  }
}

function armTurnTimer(room: Room) {
  clearTimer(room)
  if (!room.snapshot) return
  if (room.snapshot.phase !== 'BIDDING' && room.snapshot.phase !== 'PLAYING') return
  // Bot seats are handled by maybeScheduleBotTurn; no human turn timer for them.
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

// Schedule a bot move when it's their turn. Re-arms on each transition.
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

// Common post-action housekeeping: broadcast, then arm whichever timer is next.
function afterTransition(room: Room) {
  broadcastRoomState(room)
  broadcastViews(room)

  // A complete trick is sitting on the table — let humans see the last card,
  // then resolve and continue.
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

io.on('connection', (socket) => {
  let joinedRoom: string | null = null
  let playerId: string | null = null

  socket.on('room:join', (raw, cb: (resp: unknown) => void) => {
    const parsed = z
      .object({
        code: z.string(),
        playerId: z.string().min(1),
        nickname: z.string().min(1).max(20),
        seat: z.number().int().min(0).max(3).optional(),
      })
      .safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })

    const room = rooms.get(parsed.data.code.toUpperCase())
    if (!room) return cb({ ok: false, error: 'room not found' })

    // Reconnect path: same playerId already seated.
    const existingSeat = findSeatByPlayerId(room, parsed.data.playerId)
    let seat: Seat | null = existingSeat
    if (seat === null) {
      const requested = parsed.data.seat
      seat = requested !== undefined && room.seats[requested as Seat] === null
        ? (requested as Seat)
        : findFreeSeat(room)
      if (seat === null) return cb({ ok: false, error: 'room full' })
      const take = takeSeat(room, seat, parsed.data.playerId, parsed.data.nickname)
      if (!take.ok) return cb({ ok: false, error: take.error })
    } else {
      setConnected(room, parsed.data.playerId, true)
    }

    joinedRoom = room.code
    playerId = parsed.data.playerId
    socket.join(`room:${room.code}`)
    socket.join(`player:${playerId}`)
    cancelEmptyTimer(room)

    cb({ ok: true, seat, state: publicState(room) })
    broadcastRoomState(room)
    if (room.snapshot) broadcastViews(room)
  })

  socket.on('room:start', (_raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    if (findSeatByPlayerId(room, playerId) === null) {
      return cb({ ok: false, error: 'only seated players can start' })
    }
    if (!allSeatsFilled(room)) return cb({ ok: false, error: 'fill all 4 seats first' })
    const r = startGame(room)
    if (!r.ok) return cb({ ok: false, error: r.error })
    cb({ ok: true })
    afterTransition(room)
  })

  // ── Reactions / emotes ────────────────────────────────────────────
  // Six allow-listed glyphs. Anything else is rejected — no free-text chat.
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

    // Rate-limit: max one reaction per 1500ms per seat.
    const now = Date.now()
    const occ = room.seats[seat]!
    if (occ.lastReactionAt && now - occ.lastReactionAt < 1500) {
      return cb({ ok: false, error: 'too fast' })
    }
    occ.lastReactionAt = now

    cb({ ok: true })
    io.to(`room:${room.code}`).emit('room:reaction', { seat, emote: parsed.data.emote, ts: now })
  })

  socket.on('room:spectate', (raw, cb: (resp: unknown) => void) => {
    const parsed = z
      .object({
        code: z.string(),
        playerId: z.string().min(1),
        nickname: z.string().min(1).max(20),
      })
      .safeParse(raw)
    if (!parsed.success) return cb({ ok: false, error: 'invalid payload' })

    const room = rooms.get(parsed.data.code.toUpperCase())
    if (!room) return cb({ ok: false, error: 'room not found' })

    // Can't spectate a seat you also occupy.
    if (findSeatByPlayerId(room, parsed.data.playerId) !== null) {
      return cb({ ok: false, error: 'already seated' })
    }
    addSpectator(room, parsed.data.playerId, parsed.data.nickname)
    joinedRoom = room.code
    playerId = parsed.data.playerId
    socket.join(`room:${room.code}`)
    socket.join(`player:${playerId}`)
    cancelEmptyTimer(room)

    cb({ ok: true, state: publicState(room) })
    broadcastRoomState(room)
    if (room.snapshot) {
      // Send this spectator the public view immediately.
      const view = snapshotForSpectator(room)
      if (view) socket.emit('game:view', view)
    }
  })

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
    // Apply only keys the host actually set (avoid overwriting with undefined).
    const next = { ...room.settings }
    if (parsed.data.capotDoubledByContra !== undefined) next.capotDoubledByContra = parsed.data.capotDoubledByContra
    if (parsed.data.enableNT !== undefined) next.enableNT = parsed.data.enableNT
    if (parsed.data.enableAT !== undefined) next.enableAT = parsed.data.enableAT
    room.settings = next
    cb({ ok: true })
    broadcastRoomState(room)
  })

  socket.on('room:addBot', (raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    if (findSeatByPlayerId(room, playerId) === null) {
      return cb({ ok: false, error: 'only seated players can add bots' })
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
    const name = `Bot ${botCount}`
    const result = addBot(room, seat, name)
    if (!result.ok) return cb({ ok: false, error: result.error })
    cb({ ok: true, seat })
    broadcastRoomState(room)
  })

  socket.on('game:action', (raw, cb: (resp: unknown) => void) => {
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

  socket.on('disconnect', () => {
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
