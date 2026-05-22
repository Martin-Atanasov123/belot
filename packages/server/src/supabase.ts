import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as jose from 'jose'
import ws from 'ws'

// Node.js 20 lacks a native global WebSocket — polyfill before Supabase initialises.
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).WebSocket = ws
}

// Server-side Supabase client. Uses the SERVICE_ROLE key so it can bypass RLS
// when writing match history rows (the ONLY writer of public.matches and of
// tournament_matches.winner_id — clients are read-only there). Also verifies
// JWTs from connecting sockets (locally via JWT secret, or via getUser()).

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
// Optional: set SUPABASE_JWT_SECRET from Project Settings → API → JWT Secret.
// When present, tokens are verified locally (no network round-trip).
// Fallback: network call to supabase.auth.getUser().
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SERVICE_KEY)

export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — JWT verification skipped, guest mode only.',
  )
}

export type AuthedUser = {
  id: string
  email: string | null
  username: string | null
}

// Verify a Supabase access token (JWT). Returns the user info on success,
// null on any failure. Never throws — callers treat null as "guest".
//
// Fast path: if SUPABASE_JWT_SECRET is set, verify signature + expiry locally
// (zero network latency). Slower fallback: supabase.auth.getUser() network call.
export async function verifyAccessToken(token: string): Promise<AuthedUser | null> {
  // ── Fast path: local HS256 verification ─────────────────────────────
  if (JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET)
      const { payload } = await jose.jwtVerify(token, secret, {
        algorithms: ['HS256'],
      })
      if (!payload.sub) return null
      const meta = ((payload as Record<string, unknown>).user_metadata ?? {}) as Record<string, unknown>
      return {
        id: payload.sub,
        email: (payload.email as string | undefined) ?? null,
        username: (meta.username as string | undefined) ?? (meta.preferred_username as string | undefined) ?? null,
      }
    } catch {
      return null
    }
  }

  // ── Fallback: network verification ──────────────────────────────────
  if (!supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) return null
    const meta = (data.user.user_metadata ?? {}) as { username?: string; preferred_username?: string }
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      username: meta.username ?? meta.preferred_username ?? null,
    }
  } catch {
    return null
  }
}

// ── Server-authoritative persistence (SEC-001 / SEC-002) ─────────────────────
// These are the ONLY code paths that write match results. They run with the
// service_role key (bypasses RLS) so the client write paths can stay revoked.

export type MatchRowInput = {
  roomCode: string
  // seat ids ordered N,E,S,W (seats 2,3,0,1). null for guests/bots.
  seatIds: { n: string | null; e: string | null; s: string | null; w: string | null }
  seatNames: { n: string | null; e: string | null; s: string | null; w: string | null }
  scoreNS: number
  scoreEW: number
  winnerTeam: 'NS' | 'EW'
  handCount: number
  settings: unknown
  summary: unknown
  startedAt: string
}

// Insert a finished match. Returns the new row id, or null on failure / when
// Supabase isn't configured. Never throws.
export async function persistMatchRow(input: MatchRowInput): Promise<string | null> {
  if (!supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .insert({
        room_code: input.roomCode,
        seat_n_id: input.seatIds.n,
        seat_e_id: input.seatIds.e,
        seat_s_id: input.seatIds.s,
        seat_w_id: input.seatIds.w,
        seat_n_name: input.seatNames.n,
        seat_e_name: input.seatNames.e,
        seat_s_name: input.seatNames.s,
        seat_w_name: input.seatNames.w,
        score_ns: input.scoreNS,
        score_ew: input.scoreEW,
        winner_team: input.winnerTeam,
        hand_count: input.handCount,
        settings: input.settings,
        summary: input.summary,
        started_at: input.startedAt,
      })
      .select('id')
      .maybeSingle()
    if (error || !data) return null
    return data.id as string
  } catch {
    return null
  }
}

// Diagnostic only: verifies the service-role client can actually WRITE to
// public.matches (i.e. SUPABASE_URL + a real service_role key are set and
// reachable). Inserts a throwaway row and deletes it. Leaks no secrets.
export async function debugCanWrite(): Promise<{ canWrite: boolean; error?: string }> {
  if (!supabaseAdmin) return { canWrite: false, error: 'supabaseAdmin not configured' }
  try {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .insert({
        room_code: 'DIAGTEST',
        score_ns: 0,
        score_ew: 0,
        winner_team: 'NS',
        hand_count: 1,
        settings: {},
        summary: {},
        started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()
    if (error) return { canWrite: false, error: error.message }
    if (data?.id) await supabaseAdmin.from('matches').delete().eq('id', data.id as string)
    return { canWrite: true }
  } catch (e) {
    return { canWrite: false, error: String(e) }
  }
}

// Permanently delete a user's auth account. Cascades to public.profiles
// (on delete cascade); match/tournament references are set null so history is
// preserved anonymously. Returns ok/err. Never throws.
export async function deleteUserAccount(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: 'account service unavailable' }
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// Link a finished match to its tournament bracket slot and set the winner.
// `winnerUid` must be the verified uid of the player on the winning team; the
// DB trigger propagates the winner to the next round. No-op if the room isn't
// tied to a tournament match. Never throws.
export async function reportTournamentWinner(
  roomCode: string,
  matchId: string | null,
  winnerUid: string,
): Promise<void> {
  if (!supabaseAdmin) return
  try {
    const { data: tmatch } = await supabaseAdmin
      .from('tournament_matches')
      .select('id, status')
      .eq('room_code', roomCode)
      .maybeSingle()
    if (!tmatch || (tmatch as { status?: string }).status === 'finished') return
    await supabaseAdmin
      .from('tournament_matches')
      .update({ winner_id: winnerUid, match_id: matchId, status: 'finished' })
      .eq('id', (tmatch as { id: string }).id)
  } catch {
    /* best-effort */
  }
}
