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
  allSeatsFilled,
  applyAction,
  autoPlay,
  clearTimer,
  createRoom,
  findFreeSeat,
  findSeatByPlayerId,
  publicState,
  setConnected,
  snapshotForSeat,
  startGame,
  takeSeat,
  type Room,
} from './room.js'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? '*').split(',').map((s) => s.trim())

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
}

function armTurnTimer(room: Room) {
  clearTimer(room)
  if (!room.snapshot) return
  if (room.snapshot.phase !== 'BIDDING' && room.snapshot.phase !== 'PLAYING') return
  room.turnTimer = setTimeout(() => {
    const pick = autoPlay(room)
    if (!pick) return
    const r = applyAction(room, occupantPlayerId(room, pick.seat) ?? '__server__', pick.action)
    if (!r.ok && r.error === 'not seated') {
      // Bypass seating check for server-driven auto-play by injecting via internal helper.
      // Instead, set room.snapshot directly through engine apply with the action.
      const occ = room.seats[pick.seat]
      if (occ) applyAction(room, occ.playerId, pick.action)
    }
    broadcastRoomState(room)
    broadcastViews(room)
    armTurnTimer(room)
  }, TURN_TIMER_MS)
}

function occupantPlayerId(room: Room, seat: Seat): string | null {
  return room.seats[seat]?.playerId ?? null
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

    cb({ ok: true, seat, state: publicState(room) })
    broadcastRoomState(room)
    if (room.snapshot) broadcastViews(room)
  })

  socket.on('room:start', (_raw, cb: (resp: unknown) => void) => {
    if (!joinedRoom || !playerId) return cb({ ok: false, error: 'not in a room' })
    const room = rooms.get(joinedRoom)
    if (!room) return cb({ ok: false, error: 'room gone' })
    if (room.hostId !== playerId) return cb({ ok: false, error: 'only host can start' })
    if (!allSeatsFilled(room)) return cb({ ok: false, error: 'fill all 4 seats first' })
    const r = startGame(room)
    if (!r.ok) return cb({ ok: false, error: r.error })
    cb({ ok: true })
    broadcastRoomState(room)
    broadcastViews(room)
    armTurnTimer(room)
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
    broadcastViews(room)
    broadcastRoomState(room)
    armTurnTimer(room)
  })

  socket.on('disconnect', () => {
    if (!joinedRoom || !playerId) return
    const room = rooms.get(joinedRoom)
    if (!room) return
    setConnected(room, playerId, false)
    broadcastRoomState(room)
  })
})

await app.listen({ port: PORT, host: HOST })
app.log.info(`belot server listening on ${HOST}:${PORT}`)
