import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as jose from 'jose'
import ws from 'ws'

// Node.js 20 lacks a native global WebSocket — polyfill before Supabase initialises.
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).WebSocket = ws
}

// Server-side Supabase client. Uses the SERVICE_ROLE key so it can bypass RLS
// when writing match history rows. Also used to verify JWTs from connecting
// sockets via supabase.auth.getUser(token).

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
