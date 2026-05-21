import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import type { Action, PlayerView, Seat } from '@belot/shared'
import { SERVER_URL } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'

export type PublicSeat = { seat: Seat; nickname: string | null; connected: boolean; isBot: boolean }
export type PublicRoomState = {
  code: string
  hostId: string
  seats: PublicSeat[]
  inGame: boolean
  settings: { gameTo: number; enableNT: boolean; enableAT: boolean; turnTimerSec: number; allowSpectators: boolean; botsFillEmpty: boolean; capotDoubledByContra: boolean }
  spectatorCount: number
}

export type ReactionEvent = { seat: Seat; emote: string; ts: number; id: number }

// Matchmaking (Quick Play) state.
export type MMStatus = 'idle' | 'searching' | 'matched'
export type MMMatch = { code: string; withBots: boolean }

type State = {
  socket: Socket | null
  connected: boolean
  joinError: string | null
  room: PublicRoomState | null
  view: PlayerView | null
  mySeat: Seat | null
  amHost: boolean
  amSpectator: boolean
  hostId: string | null
  reactions: ReactionEvent[] // queue; entries auto-dropped after ~2s by the UI
  mmStatus: MMStatus
  mmJoinedAt: number | null
  mmMatch: MMMatch | null
  connect: () => Socket
  clearJoinError: () => void
  join: (args: { code: string; playerId: string; nickname: string; isHost: boolean }) => Promise<{ ok: boolean; error?: string }>
  spectate: (args: { code: string; playerId: string; nickname: string }) => Promise<{ ok: boolean; error?: string }>
  start: () => Promise<{ ok: boolean; error?: string }>
  addBot: (seat?: Seat) => Promise<{ ok: boolean; error?: string }>
  setSettings: (patch: { capotDoubledByContra?: boolean; enableNT?: boolean; enableAT?: boolean }) => Promise<{ ok: boolean; error?: string }>
  react: (emote: string) => Promise<{ ok: boolean; error?: string }>
  dismissReaction: (id: number) => void
  send: (action: Action) => Promise<{ ok: boolean; error?: string }>
  findMatch: (args: { playerId: string; nickname: string; botFillAfterMs?: number | null }) => Promise<{ ok: boolean; error?: string }>
  cancelFindMatch: () => Promise<{ ok: boolean; error?: string }>
  clearMMMatch: () => void
}

export const useGame = create<State>((set, get) => ({
  socket: null,
  connected: false,
  joinError: null,
  room: null,
  view: null,
  mySeat: null,
  amHost: false,
  amSpectator: false,
  hostId: null,
  reactions: [],
  mmStatus: 'idle',
  mmJoinedAt: null,
  mmMatch: null,

  connect: () => {
    const existing = get().socket
    if (existing) return existing
    // If the user is signed in, the Supabase JWT is attached to the handshake
    // (auth.token). The server verifies it in its io.use() middleware and binds
    // the authed identity to socket.data.user. Guests connect with no token.
    const sock = io(SERVER_URL, {
      transports: ['websocket'],
      auth: (cb) => {
        void supabase.auth.getSession().then(({ data }) => {
          cb({ token: data.session?.access_token ?? '' })
        })
      },
    })
    sock.on('connect', () => set({ connected: true }))
    sock.on('disconnect', () => set({ connected: false }))
    sock.on('room:state', (state: PublicRoomState) => {
      const myId = get().hostId // we stored "my playerId" here on join
      set({ room: state, amHost: !!myId && state.hostId === myId })
    })
    sock.on('game:view', (view: PlayerView) => set({ view }))
    sock.on('room:reaction', (r: { seat: Seat; emote: string; ts: number }) => {
      const id = Date.now() + Math.random()
      set((s) => ({ reactions: [...s.reactions, { ...r, id }] }))
    })
    // Matchmaking: server pushes the room code we got matched into.
    sock.on('mm:matched', (m: MMMatch) => {
      set({ mmStatus: 'matched', mmMatch: m })
    })

    // When Supabase silently refreshes the JWT (typically every hour), push the
    // new token to the server so the socket-level identity cache stays current.
    // Without this, an authenticated socket's server-side user reference becomes
    // stale after the access token expires (~1 h by default in Supabase).
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.access_token && sock.connected) {
        sock.emit('auth:refresh', { token: session.access_token })
      }
    })

    set({ socket: sock })
    return sock
  },

  clearJoinError: () => set({ joinError: null }),

  join: ({ code, playerId, nickname, isHost }) =>
    new Promise((resolve) => {
      const sock = get().connect()
      // Guest reconnect secret (SEC-004): present the token minted on our first
      // join so the server lets us reclaim our seat. Authed users reconnect via
      // their JWT, so the token is simply absent for them on a fresh device.
      const tokenKey = `belot.seat.${code.toUpperCase()}`
      const seatToken = (() => {
        try { return localStorage.getItem(tokenKey) ?? undefined } catch { return undefined }
      })()
      const send = () =>
        sock.emit(
          'room:join',
          { code, playerId, nickname, seatToken },
          (resp: { ok: boolean; error?: string; seat?: Seat; state?: PublicRoomState; seatToken?: string | null }) => {
            if (resp.ok) {
              const roomState = resp.state ?? null
              // Persist the seat token so a refresh/reconnect can prove identity.
              if (resp.seatToken) {
                try { localStorage.setItem(tokenKey, resp.seatToken) } catch { /* ignore */ }
              }
              set({
                mySeat: resp.seat ?? null,
                room: roomState,
                amHost: roomState ? roomState.hostId === playerId : isHost,
                amSpectator: false,
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

  spectate: ({ code, playerId, nickname }) =>
    new Promise((resolve) => {
      const sock = get().connect()
      const send = () =>
        sock.emit(
          'room:spectate',
          { code, playerId, nickname },
          (resp: { ok: boolean; error?: string; state?: PublicRoomState }) => {
            if (resp.ok) {
              const roomState = resp.state ?? null
              set({
                mySeat: null,
                room: roomState,
                amHost: false,
                amSpectator: true,
                hostId: playerId,
                joinError: null,
              })
              resolve({ ok: true })
            } else {
              const err = resp.error ?? 'spectate failed'
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

  addBot: (seat) =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit(
        'room:addBot',
        seat !== undefined ? { seat } : {},
        (resp: { ok: boolean; error?: string }) => resolve(resp),
      )
    }),

  setSettings: (patch) =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('room:setSettings', patch, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  react: (emote) =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('room:react', { emote }, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  dismissReaction: (id) =>
    set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })),

  send: (action) =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('game:action', action, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  // ── Matchmaking (Quick Play) ─────────────────────────────────────────────
  findMatch: ({ playerId, nickname, botFillAfterMs }) =>
    new Promise((resolve) => {
      const sock = get().connect()
      const send = () =>
        sock.emit(
          'mm:join',
          { playerId, nickname, botFillAfterMs },
          (resp: { ok: boolean; error?: string }) => {
            if (resp.ok) {
              set({ mmStatus: 'searching', mmJoinedAt: Date.now(), mmMatch: null })
            }
            resolve(resp)
          },
        )
      if (sock.connected) send()
      else sock.once('connect', send)
    }),

  cancelFindMatch: () =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) {
        set({ mmStatus: 'idle', mmJoinedAt: null })
        return resolve({ ok: true })
      }
      sock.emit('mm:leave', {}, (resp: { ok: boolean; error?: string }) => {
        set({ mmStatus: 'idle', mmJoinedAt: null })
        resolve(resp)
      })
    }),

  clearMMMatch: () => set({ mmStatus: 'idle', mmMatch: null, mmJoinedAt: null }),
}))
