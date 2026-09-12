import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import {
  advanceHand,
  apply,
  autoPickOnTimeout,
  isError,
  newMatch,
  pickBotBid,
  pickBotCard,
  projectView,
  resolveTrick,
} from '@belot/engine'
import {
  DEFAULT_SETTINGS,
  type Action,
  type BotDifficulty,
  type GameSnapshot,
  type PlayerView,
  type RoomSettings,
  type Seat,
} from '@belot/shared'
import { SERVER_URL } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'

export type PublicSeat = { seat: Seat; nickname: string | null; connected: boolean; isBot: boolean }
export type PublicRoomState = {
  code: string
  hostId: string
  seats: PublicSeat[]
  inGame: boolean
  settings: { gameTo: number; enableNT: boolean; enableAT: boolean; turnTimerSec: number; allowSpectators: boolean; botsFillEmpty: boolean; capotDoubledByContra: boolean; botDifficulty: 'easy' | 'medium' | 'hard' }
  spectatorCount: number
  isQuickMatch: boolean
  botVotes: number
  botVoteThreshold: number
}

export type ReactionEvent = { seat: Seat; emote: string; ts: number; id: number }

// Play mode:
//   'remote' — normal socket-driven multiplayer (find match / private room)
//   'local'  — offline solo-vs-bots, engine runs entirely in the browser.
//              No server dependency — kills the Render cold-start bounce for
//              a new visitor's first game. See CLAUDE.md § 0.5.5.
export type PlayMode = 'remote' | 'local'

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
  reactions: ReactionEvent[]
  onlineCount: number
  // Local-mode state — populated by startLocalGame and mutated in-browser.
  mode: PlayMode
  localSnap: GameSnapshot | null

  connect: () => Socket
  clearJoinError: () => void
  join: (args: { code: string; playerId: string; nickname: string; isHost: boolean }) => Promise<{ ok: boolean; error?: string }>
  spectate: (args: { code: string; playerId: string; nickname: string }) => Promise<{ ok: boolean; error?: string }>
  start: () => Promise<{ ok: boolean; error?: string }>
  addBot: (seat?: Seat) => Promise<{ ok: boolean; error?: string }>
  voteBots: () => Promise<{ ok: boolean; error?: string }>
  setSettings: (patch: { capotDoubledByContra?: boolean; enableNT?: boolean; enableAT?: boolean; turnTimerSec?: number; gameTo?: 101 | 151; botDifficulty?: 'easy' | 'medium' | 'hard' }) => Promise<{ ok: boolean; error?: string }>
  react: (emote: string) => Promise<{ ok: boolean; error?: string }>
  dismissReaction: (id: number) => void
  send: (action: Action) => Promise<{ ok: boolean; error?: string }>
  findMatch: (args: { playerId: string; nickname: string }) => Promise<{ ok: boolean; code?: string; error?: string }>

  // ── Local mode ────────────────────────────────────────────────────────────
  // Start an offline game against three bots. The user always sits at seat 0.
  // Difficulty defaults to 'medium'; capot doubling to the standard rule.
  startLocalGame: (opts?: { botDifficulty?: BotDifficulty; nickname?: string; gameTo?: 101 | 151 }) => void
  // Leave a local game and return the store to a clean multiplayer state.
  exitLocalGame: () => void
}

// ── Local-mode helpers ────────────────────────────────────────────────────

// Build a synthetic room object so all downstream UI (seat labels, HUD,
// composition chip, victory screen) works exactly as it does in multiplayer.
function makeLocalRoom(nickname: string, settings: RoomSettings): PublicRoomState {
  return {
    code: 'SOLO',
    hostId: 'you',
    seats: [
      { seat: 0, nickname, connected: true, isBot: false },
      { seat: 1, nickname: 'Бот Изток', connected: true, isBot: true },
      { seat: 2, nickname: 'Бот Север', connected: true, isBot: true },
      { seat: 3, nickname: 'Бот Запад', connected: true, isBot: true },
    ],
    inGame: true,
    settings,
    spectatorCount: 0,
    isQuickMatch: false,
    botVotes: 0,
    botVoteThreshold: 0,
  }
}

// Advance any auto-resolutions after an action (trick resolution, hand
// advance, game over) and schedule the next bot turn if applicable.
// Called after every action — human or bot — in local mode.
function advanceLocalState(
  snap: GameSnapshot,
  applySet: (patch: { localSnap: GameSnapshot | null; view: PlayerView | null }) => void,
  scheduleBot: () => void,
): GameSnapshot {
  let s = snap

  // Complete-trick auto-resolve. In multiplayer the server pauses ~800 ms
  // so players see the last card before the sweep. For local play we mirror
  // that visual beat by resolving asynchronously — but ONLY when the human's
  // card completes the trick, so the player sees their play land before the
  // trick sweeps away.
  if (s.phase === 'PLAYING' && s.currentTrick && s.currentTrick.cards.length === 4) {
    // Fire-and-forget: after the sweep pause, resolve and re-schedule.
    const paused = s
    setTimeout(() => {
      const r = resolveTrick(paused)
      if (isError(r)) return
      let next = r
      // If the trick resolved into HAND_OVER (last trick of the hand), advance.
      if (next.phase === 'HAND_OVER') {
        const a = advanceHand(next)
        if (!isError(a)) next = a
      }
      applySet({ localSnap: next, view: projectView(next, 0 as Seat) })
      if (next.phase !== 'GAME_OVER' && next.turn !== 0) scheduleBot()
    }, 900)
    // Return the pre-resolve snap so the trick pile is briefly visible.
    return s
  }

  // Hand transition — award scores + start next hand. When the previous
  // action was the last play of a hand that DIDN'T complete via a full trick
  // (shouldn't normally happen but be defensive), advance immediately.
  if (s.phase === 'HAND_OVER') {
    const a = advanceHand(s)
    if (!isError(a)) s = a
  }

  return s
}

// Pick the next action for a bot seat and return it, or null if bot can't act.
function botActionForSeat(snap: GameSnapshot, difficulty: BotDifficulty): Action | null {
  if (snap.phase === 'BIDDING') {
    return pickBotBid(snap, difficulty)
  }
  if (snap.phase === 'PLAYING') {
    let card = null
    try { card = pickBotCard(snap, difficulty) } catch { /* fall through */ }
    card = card ?? autoPickOnTimeout(snap)
    if (!card) return null
    return { type: 'PLAY', seat: snap.turn, card }
  }
  return null
}

export const useGame = create<State>((set, get) => {
  // Bot turn scheduler for local play. Fires the current bot's action after
  // a humane delay (matches server's BOT_TURN_DELAY_MS = 750 ms).
  const scheduleBotTurn = () => {
    setTimeout(() => runBotTurn(), 750)
  }

  const runBotTurn = () => {
    const st = get()
    if (st.mode !== 'local') return
    const snap = st.localSnap
    if (!snap) return
    if (snap.turn === 0) return // human's turn — user drives
    if (snap.phase === 'GAME_OVER') return
    const diff = st.room?.settings.botDifficulty ?? 'medium'
    const action = botActionForSeat(snap, diff)
    if (!action) return
    const r = apply(snap, action)
    if (isError(r)) return
    const next = advanceLocalState(
      r,
      (patch) => set(patch),
      scheduleBotTurn,
    )
    set({ localSnap: next, view: projectView(next, 0 as Seat) })
    if (next.phase !== 'GAME_OVER' && next.turn !== 0 && !(next.phase === 'PLAYING' && next.currentTrick?.cards.length === 4)) {
      scheduleBotTurn()
    }
  }

  return {
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
  onlineCount: 0,
  mode: 'remote',
  localSnap: null,

  connect: () => {
    const existing = get().socket
    if (existing) return existing
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
      const myId = get().hostId
      set({ room: state, amHost: !!myId && state.hostId === myId })
    })
    sock.on('game:view', (view: PlayerView) => set({ view }))
    sock.on('online:count', (p: { count: number }) => set({ onlineCount: p.count }))
    sock.on('room:reaction', (r: { seat: Seat; emote: string; ts: number }) => {
      const id = Date.now() + Math.random()
      set((s) => ({ reactions: [...s.reactions, { ...r, id }] }))
    })

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
      const tokenKey = `belot.seat.${code.toUpperCase()}`
      const seatToken = (() => {
        try { return localStorage.getItem(tokenKey) ?? undefined } catch { return undefined }
      })()
      const doSend = () =>
        sock.emit(
          'room:join',
          { code, playerId, nickname, seatToken },
          (resp: { ok: boolean; error?: string; seat?: Seat; state?: PublicRoomState; seatToken?: string | null }) => {
            if (resp.ok) {
              const roomState = resp.state ?? null
              if (resp.seatToken) {
                try { localStorage.setItem(tokenKey, resp.seatToken) } catch { /* ignore */ }
              }
              set({
                mode: 'remote',
                localSnap: null,
                mySeat: resp.seat ?? null,
                room: roomState,
                view: null,
                reactions: [],
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
      if (sock.connected) doSend()
      else sock.once('connect', doSend)
    }),

  spectate: ({ code, playerId, nickname }) =>
    new Promise((resolve) => {
      const sock = get().connect()
      const doSend = () =>
        sock.emit(
          'room:spectate',
          { code, playerId, nickname },
          (resp: { ok: boolean; error?: string; state?: PublicRoomState }) => {
            if (resp.ok) {
              const roomState = resp.state ?? null
              set({
                mode: 'remote',
                localSnap: null,
                mySeat: null,
                room: roomState,
                view: null,
                reactions: [],
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
      if (sock.connected) doSend()
      else sock.once('connect', doSend)
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

  voteBots: () =>
    new Promise((resolve) => {
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('room:voteBots', {}, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  setSettings: (patch) =>
    new Promise((resolve) => {
      // In local mode: mutate the fake room's settings in-store; no round trip.
      if (get().mode === 'local') {
        const room = get().room
        if (!room) return resolve({ ok: false, error: 'no room' })
        set({ room: { ...room, settings: { ...room.settings, ...patch } } })
        return resolve({ ok: true })
      }
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('room:setSettings', patch, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  react: (emote) =>
    new Promise((resolve) => {
      // Reactions have no effect in local play (no one else to see them).
      if (get().mode === 'local') return resolve({ ok: true })
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('room:react', { emote }, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  dismissReaction: (id) =>
    set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })),

  send: (action) =>
    new Promise((resolve) => {
      // ── Local mode: run the reducer in-browser, then schedule bot turns.
      if (get().mode === 'local') {
        const snap = get().localSnap
        if (!snap) return resolve({ ok: false, error: 'no local game' })
        // Only the human seat may act from this store; bots move via the
        // scheduler. Reject anything else so a stale click can't jump turns.
        if (action.seat !== undefined && action.seat !== 0) {
          return resolve({ ok: false, error: 'not your turn' })
        }
        const r = apply(snap, action)
        if (isError(r)) return resolve({ ok: false, error: r.error })
        const next = advanceLocalState(
          r,
          (patch) => set(patch),
          scheduleBotTurn,
        )
        set({ localSnap: next, view: projectView(next, 0 as Seat) })
        // Schedule bot turn unless a trick is pending (its resolver schedules
        // the next bot itself after the visual sweep).
        const trickPending = next.phase === 'PLAYING'
          && next.currentTrick?.cards.length === 4
        if (next.phase !== 'GAME_OVER' && next.turn !== 0 && !trickPending) {
          scheduleBotTurn()
        }
        return resolve({ ok: true })
      }
      // ── Remote mode: standard socket action.
      const sock = get().socket
      if (!sock) return resolve({ ok: false, error: 'no socket' })
      sock.emit('game:action', action, (resp: { ok: boolean; error?: string }) => resolve(resp))
    }),

  findMatch: ({ playerId, nickname }) =>
    new Promise((resolve) => {
      const sock = get().connect()
      const doSend = () =>
        sock.emit(
          'mm:join',
          { playerId, nickname },
          (resp: { ok: boolean; code?: string; error?: string }) => resolve(resp),
        )
      if (sock.connected) doSend()
      else sock.once('connect', doSend)
    }),

  startLocalGame: (opts) => {
    const nickname = opts?.nickname?.trim() || 'Ти'
    const settings: RoomSettings = {
      ...DEFAULT_SETTINGS,
      botDifficulty: opts?.botDifficulty ?? DEFAULT_SETTINGS.botDifficulty,
      gameTo: opts?.gameTo ?? DEFAULT_SETTINGS.gameTo,
    }
    const snap = newMatch({ seed: (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0, settings })
    set({
      mode: 'local',
      localSnap: snap,
      view: projectView(snap, 0 as Seat),
      room: makeLocalRoom(nickname, settings),
      mySeat: 0 as Seat,
      amHost: true,
      amSpectator: false,
      hostId: 'you',
      reactions: [],
      joinError: null,
    })
    // If a bot is first to bid (dealer sat at 0 means seat 1 opens), schedule.
    if (snap.turn !== 0) scheduleBotTurn()
  },

  exitLocalGame: () => {
    set({
      mode: 'remote',
      localSnap: null,
      view: null,
      room: null,
      mySeat: null,
      amHost: false,
      amSpectator: false,
      hostId: null,
      reactions: [],
    })
  },
}})
