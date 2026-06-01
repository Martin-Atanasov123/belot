/**
 * Integration test: full match persistence (Task #26)
 *
 * Plays one complete belot match (1 human + 3 bots) against a running server
 * and asserts that the finished match lands in public.matches.
 *
 * Required env vars (the test skips gracefully when any are absent):
 *   INTEGRATION_SERVER_URL   — default http://localhost:3001
 *   SUPABASE_JWT_SECRET      — must match the server's JWT_SECRET (local verify path)
 *   SUPABASE_URL             — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key for the assertion query
 *
 * Run with the server already started:
 *   npm run dev --workspace @belot/server &
 *   SUPABASE_JWT_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   vitest run test/persistence.spec.ts
 *
 * The test creates one row in public.matches and deletes it after the assertion
 * so repeated runs stay idempotent.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import * as jose from 'jose'
import { createClient } from '@supabase/supabase-js'
import { isLegalPlay } from '@belot/engine'
import type { Card, PlayerView, Seat, Contract, Suit, Trick } from '@belot/shared'

// ── Env ──────────────────────────────────────────────────────────────────────

const SERVER_URL  = process.env.INTEGRATION_SERVER_URL ?? 'http://localhost:3001'
const JWT_SECRET  = process.env.SUPABASE_JWT_SECRET ?? ''
const SUPA_URL    = process.env.SUPABASE_URL ?? ''
const SUPA_SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const canRun =
  JWT_SECRET.length > 0 &&
  SUPA_URL.length > 0 &&
  SUPA_SR_KEY.length > 0

// Stable test user id — not a real Supabase account. The server only verifies
// the JWT signature and reads sub as userId. We delete the row afterwards.
const TEST_USER_ID = '00000000-test-4e2e-b000-persistence001'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function mintJwt(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return new jose.SignJWT({
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated',
    email: 'e2e-persist@belot.test',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret)
}

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // Pass JWT in the Socket.IO handshake — the server's io.use() middleware
    // picks it up and sets socket.data.user. That makes subsequent room:join
    // calls automatically bind our userId to the seat (no extra event needed).
    const sock = io(SERVER_URL, {
      transports: ['websocket'],
      auth: { token },
    })
    const timer = setTimeout(() => {
      sock.disconnect()
      reject(new Error(`Could not connect to ${SERVER_URL} — is the server running?`))
    }, 5_000)
    sock.on('connect', () => { clearTimeout(timer); resolve(sock) })
    sock.on('connect_error', (err) => { clearTimeout(timer); reject(err) })
  })
}

function ack<T = { ok: boolean; error?: string }>(
  sock: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) => sock.emit(event, payload, (r: T) => resolve(r)))
}

/** Wait for the next game:view that satisfies the predicate. */
function waitView(
  sock: Socket,
  predicate: (v: PlayerView) => boolean,
  timeoutMs = 120_000,
): Promise<PlayerView> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`waitView timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
    const handler = (v: PlayerView) => {
      if (predicate(v)) {
        clearTimeout(timer)
        sock.off('game:view', handler)
        resolve(v)
      }
    }
    sock.on('game:view', handler)
  })
}

/** Cheapest legal card from hand — mirrors the easy-bot heuristic. */
function cheapestLegal(
  hand: Card[],
  trick: Trick,
  contract: Contract,
  trump: Suit | null,
): Card | null {
  const legal = hand.filter((c) => isLegalPlay(c, hand, trick, contract, trump))
  if (legal.length === 0) return null
  const pts = (c: Card): number => {
    const tr: Record<string, number> = { '7': 0, '8': 0, 'Q': 3, 'K': 4, '10': 10, 'A': 11, '9': 14, 'J': 20 }
    const pl: Record<string, number> = { '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 }
    return trump && c.suit === trump ? (tr[c.rank] ?? 0) : (pl[c.rank] ?? 0)
  }
  return [...legal].sort((a, b) => pts(a) - pts(b))[0]!
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe.skipIf(!canRun)(
  'E2E: full match persisted to public.matches (requires running server + Supabase)',
  () => {
    let sock: Socket
    let token: string
    let roomCode: string
    let mySeat: Seat

    // Per-hand bidding flag — reset each time a new hand starts (handNo changes).
    let lastHandNo = -1
    let bidThisHand = false

    // Auto-play: fires on every game:view; acts only when it is our turn.
    function autoPlay(view: PlayerView) {
      if (view.phase === 'GAME_OVER') return
      if (view.turn !== mySeat) return

      // Reset bid-per-hand tracker when a new hand begins.
      if (view.handNo !== lastHandNo) {
        lastHandNo = view.handNo
        bidThisHand = false
      }

      if (view.phase === 'BIDDING') {
        // Open with 'C' the first time we get to bid in this hand so there is
        // at least one live bid (avoids infinite all-pass redeals). After that PASS.
        const alreadyHaveLiveBid = view.bidHistory.some((h) => h.type === 'BID')
        if (!bidThisHand && !alreadyHaveLiveBid) {
          bidThisHand = true
          void ack(sock, 'game:action', { type: 'BID', seat: mySeat, contract: 'C' })
        } else {
          void ack(sock, 'game:action', { type: 'PASS', seat: mySeat })
        }
        return
      }

      if (view.phase === 'PLAYING') {
        const trick = view.currentTrick
        if (!trick || trick.cards.length >= 4) return
        if (!view.contract) return
        const card = cheapestLegal(view.yourHand, trick, view.contract, view.trump)
        if (!card) return
        void ack(sock, 'game:action', { type: 'PLAY', seat: mySeat, card })
      }
    }

    beforeAll(async () => {
      token = await mintJwt(TEST_USER_ID)
      sock = await connectSocket(token)

      // Create a private room (via the HTTP endpoint so we can supply the JWT).
      const createResp = await fetch(`${SERVER_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hostId: TEST_USER_ID }),
      })
      expect(createResp.ok, `POST /rooms failed: ${createResp.status}`).toBe(true)
      const { code } = (await createResp.json()) as { code: string }
      roomCode = code

      // Join as host. The handshake JWT means the server will record our userId
      // on the seat automatically (currentUser() in the room:join handler).
      const joinResp = await ack<{ ok: boolean; seat?: Seat; error?: string }>(
        sock,
        'room:join',
        { code: roomCode, playerId: TEST_USER_ID, nickname: 'E2ETest' },
      )
      expect(joinResp.ok, `room:join failed: ${joinResp.error ?? '?'}`).toBe(true)
      mySeat = joinResp.seat!

      // Fill the other three seats with bots.
      for (let i = 0; i < 3; i++) {
        const r = await ack(sock, 'room:addBot', {})
        expect(r.ok, `room:addBot #${i + 1} failed: ${r.error ?? '?'}`).toBe(true)
      }

      // Attach auto-play before start so we catch the very first game:view.
      sock.on('game:view', autoPlay)

      // Start!
      const startResp = await ack(sock, 'room:start', {})
      expect(startResp.ok, `room:start failed: ${startResp.error ?? '?'}`).toBe(true)
    }, 20_000)

    afterAll(() => {
      sock?.off('game:view', autoPlay)
      sock?.disconnect()
    })

    it('scenario: play a full match to GAME_OVER', async () => {
      const finalView = await waitView(sock, (v) => v.phase === 'GAME_OVER', 120_000)

      expect(finalView.phase).toBe('GAME_OVER')
      const { NS, EW } = finalView.matchScore
      expect(
        Math.max(NS, EW),
        `Expected at least one team at 151 tens, got NS=${NS} EW=${EW}`,
      ).toBeGreaterThanOrEqual(151)
    }, 130_000)

    it('scenario: server wrote a matches row for this room (SEC-001 guard)', async () => {
      // The persist is async; give it a moment after GAME_OVER.
      await new Promise((r) => setTimeout(r, 2_500))

      // 1. Debug endpoint confirms this specific room code was persisted.
      const debugResp = await fetch(`${SERVER_URL}/debug/last-match`)
      expect(debugResp.ok).toBe(true)
      const { code: persistedCode } = (await debugResp.json()) as { code: string | null }
      expect(persistedCode).toBe(roomCode)

      // 2. Service-role Supabase client reads the actual row (the ground truth).
      const admin = createClient(SUPA_URL, SUPA_SR_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await admin
        .from('matches')
        .select('id, room_code, winner_team, score_ns, score_ew, seat_s_id')
        .eq('room_code', roomCode)
        .maybeSingle()

      expect(error, `Supabase query error: ${JSON.stringify(error)}`).toBeNull()
      expect(data, 'Expected a matches row but got null').not.toBeNull()
      expect(data!.room_code).toBe(roomCode)
      expect(['NS', 'EW']).toContain(data!.winner_team)
      // Our seat is S (seat 0 maps to S in the seat schema N=2,E=3,S=0,W=1).
      // Verify our userId landed on at least one seat so the row is meaningful.
      const seatN = data!.seat_n_id
      const seatS = data!.seat_s_id
      const hasOurId = [seatN, seatS].includes(TEST_USER_ID) ||
        // Fall-through: check all four seats in the raw response too.
        Object.values(data as Record<string, unknown>).includes(TEST_USER_ID)
      expect(hasOurId, 'Expected our test userId on at least one seat').toBe(true)

      // Clean up: delete the test row so repeated runs stay idempotent.
      if (data?.id) {
        await admin.from('matches').delete().eq('id', data.id as string)
      }
    }, 15_000)
  },
)
