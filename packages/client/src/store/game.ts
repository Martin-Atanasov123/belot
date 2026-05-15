import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import type { Action, PlayerView, Seat } from '@belot/shared'
import { SERVER_URL } from '../lib/api.js'

export type PublicSeat = { seat: Seat; nickname: string | null; connected: boolean }
export type PublicRoomState = {
  code: string
  seats: PublicSeat[]
  inGame: boolean
  settings: { gameTo: number; enableNT: boolean; enableAT: boolean; turnTimerSec: number; allowSpectators: boolean; botsFillEmpty: boolean }
}

type State = {
  socket: Socket | null
  connected: boolean
  joinError: string | null
  room: PublicRoomState | null
  view: PlayerView | null
  mySeat: Seat | null
  amHost: boolean
  hostId: string | null
  connect: () => Socket
  join: (args: { code: string; playerId: string; nickname: string; isHost: boolean }) => Promise<{ ok: boolean; error?: string }>
  start: () => Promise<{ ok: boolean; error?: string }>
  send: (action: Action) => Promise<{ ok: boolean; error?: string }>
}

export const useGame = create<State>((set, get) => ({
  socket: null,
  connected: false,
  joinError: null,
  room: null,
  view: null,
  mySeat: null,
  amHost: false,
  hostId: null,

  connect: () => {
    const existing = get().socket
    if (existing) return existing
    const sock = io(SERVER_URL, { transports: ['websocket'] })
    sock.on('connect', () => set({ connected: true }))
    sock.on('disconnect', () => set({ connected: false }))
    sock.on('room:state', (state: PublicRoomState) => set({ room: state }))
    sock.on('game:view', (view: PlayerView) => set({ view }))
    set({ socket: sock })
    return sock
  },

  join: ({ code, playerId, nickname, isHost }) =>
    new Promise((resolve) => {
      const sock = get().connect()
      const send = () =>
        sock.emit(
          'room:join',
          { code, playerId, nickname },
          (resp: { ok: boolean; error?: string; seat?: Seat; state?: PublicRoomState }) => {
            if (resp.ok) {
              set({
                mySeat: resp.seat ?? null,
                room: resp.state ?? null,
                amHost: isHost,
                hostId: playerId,
                joinError: null,
              })
              resolve({ ok: true })
            } else {
              const err = resp.error ?? 'join failed'
              set({ joinError: err })
              resolve({ ok: false, error: err })
            }
          },
        )
      if (sock.connected) send()
      else sock.once('connect', send)
    }),

  start: () =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('room:start', {}, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  send: (action) =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('game:action', action, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),
}))
