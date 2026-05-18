import { createClient, type Session, type User } from '@supabase/supabase-js'

// Single Supabase browser client. Reads the project URL + anon key from Vite
// env (set in `.env.local`). The anon key is safe to expose in the browser —
// Row-Level Security policies in the database enforce per-user access.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Don't throw — guest mode must still work without Supabase configured.
  // The auth pages will surface a clear error when the user tries to sign in.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — auth disabled (guest mode only).',
  )
}

export const supabase = createClient(SUPABASE_URL ?? 'http://localhost', SUPABASE_ANON_KEY ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for OAuth + password-reset callbacks
    storageKey: 'belot.supabase.auth',
  },
})

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export type { Session, User }
