import { create } from 'zustand'
import { supabase, type Session, type User } from './supabase.js'

// Auth store — wraps Supabase session + profile row.
// Initialized once on app load via `bootstrapAuth()`. After that the store
// stays in sync via the onAuthStateChange callback.

export type Profile = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  locale: 'bg' | 'en'
  is_premium: boolean
}

type AuthState = {
  status: 'loading' | 'ready'
  session: Session | null
  user: User | null
  profile: Profile | null
  setSession: (s: Session | null) => Promise<void>
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  user: null,
  profile: null,

  setSession: async (session: Session | null) => {
    set({ session, user: session?.user ?? null, status: 'ready' })
    if (session?.user) {
      await get().refreshProfile()
    } else {
      set({ profile: null })
    }
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, locale, is_premium')
      .eq('id', user.id)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[auth] refreshProfile failed:', error.message)
      return
    }
    set({ profile: (data as Profile | null) ?? null })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },
}))

// Call once on app boot. Pulls the existing session (if any) from localStorage
// and subscribes to future auth state changes.
let bootstrapped = false
export function bootstrapAuth() {
  if (bootstrapped) return
  bootstrapped = true

  supabase.auth.getSession().then(({ data }) => {
    void useAuth.getState().setSession(data.session)
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    void useAuth.getState().setSession(session)
  })
}

// Convenience selector — true while we're still resolving the initial session.
export const selectAuthLoading = (s: AuthState) => s.status === 'loading'
