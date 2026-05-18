import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-side Supabase client. Uses the SERVICE_ROLE key so it can bypass RLS
// when writing match history rows. Also used to verify JWTs from connecting
// sockets via supabase.auth.getUser(token).

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const isSupabaseConfigured = Boolean(URL && SERVICE_KEY)

export const supabaseAdmin: SupabaseClient | null = isSupabaseConfigured
  ? createClient(URL!, SERVICE_KEY!, {
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
export async function verifyAccessToken(token: string): Promise<AuthedUser | null> {
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
