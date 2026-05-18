import { supabase, isSupabaseConfigured } from './supabase.js'
import { isValidBracketSize, planRound1, type BracketSize } from './bracket.js'

// Phase D — tournament data layer. Mirrors lib/stats.ts patterns:
// tolerant of unconfigured Supabase, console-warns on errors, never throws.

export type TournamentStatus = 'upcoming' | 'registration' | 'active' | 'finished' | 'cancelled'

export type TournamentRow = {
  id: string
  name: string
  format: 'single_elim'
  bracket_size: BracketSize
  status: TournamentStatus
  starts_at: string
  registration_closes_at: string
  created_by: string | null
  winner_id: string | null
  winner_username: string | null
  registration_count: number
  created_at: string
}

export type TournamentRegistration = {
  id: string
  tournament_id: string
  player_id: string
  joined_at: string
  seed: number | null
  username: string | null
  avatar_url: string | null
}

export type TournamentMatchRow = {
  id: string
  tournament_id: string
  round: number
  slot: number
  player_a_id: string | null
  player_b_id: string | null
  player_a_name: string | null
  player_b_name: string | null
  winner_id: string | null
  match_id: string | null
  room_code: string | null
  status: 'pending' | 'ready' | 'active' | 'finished'
  started_at: string | null
  finished_at: string | null
}

// ── List queries ────────────────────────────────────────────────────────────

export async function fetchTournaments(
  status: TournamentStatus | 'all' = 'all',
): Promise<TournamentRow[]> {
  if (!isSupabaseConfigured) return []
  let q = supabase
    .from('tournament_listings')
    .select(
      'id, name, format, bracket_size, status, starts_at, registration_closes_at, created_by, winner_id, winner_username, registration_count, created_at',
    )
    .order('starts_at', { ascending: status === 'finished' ? false : true })
    .limit(50)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) {
    console.warn('[tournaments] list:', error.message)
    return []
  }
  return (data ?? []) as TournamentRow[]
}

export async function fetchTournament(id: string): Promise<TournamentRow | null> {
  if (!isSupabaseConfigured || !id) return null
  const { data, error } = await supabase
    .from('tournament_listings')
    .select(
      'id, name, format, bracket_size, status, starts_at, registration_closes_at, created_by, winner_id, winner_username, registration_count, created_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.warn('[tournaments] detail:', error.message)
    return null
  }
  return (data as TournamentRow | null) ?? null
}

// ── Registration queries ─────────────────────────────────────────────────────

export async function fetchRegistrations(tournamentId: string): Promise<TournamentRegistration[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id, tournament_id, player_id, joined_at, seed, profiles!inner(username, avatar_url)')
    .eq('tournament_id', tournamentId)
    .order('joined_at', { ascending: true })
  if (error) {
    console.warn('[tournaments] registrations:', error.message)
    return []
  }
  type RawRow = {
    id: string
    tournament_id: string
    player_id: string
    joined_at: string
    seed: number | null
    profiles?: { username?: string; avatar_url?: string | null }
  }
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    tournament_id: r.tournament_id,
    player_id: r.player_id,
    joined_at: r.joined_at,
    seed: r.seed,
    username: r.profiles?.username ?? null,
    avatar_url: r.profiles?.avatar_url ?? null,
  }))
}

export async function isRegistered(tournamentId: string, playerId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (error) {
    console.warn('[tournaments] isRegistered:', error.message)
    return false
  }
  return !!data
}

export async function registerForTournament(
  tournamentId: string,
  playerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'supabase not configured' }
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: tournamentId, player_id: playerId })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function unregisterFromTournament(
  tournamentId: string,
  playerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'supabase not configured' }
  const { error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Match queries ────────────────────────────────────────────────────────────

export async function fetchTournamentMatches(tournamentId: string): Promise<TournamentMatchRow[]> {
  if (!isSupabaseConfigured) return []
  // Pull matches; the profile usernames are joined separately to keep the query
  // straightforward across nullable FK relationships.
  const { data, error } = await supabase
    .from('tournament_matches')
    .select(
      'id, tournament_id, round, slot, player_a_id, player_b_id, winner_id, match_id, room_code, status, started_at, finished_at',
    )
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('slot', { ascending: true })
  if (error) {
    console.warn('[tournaments] matches:', error.message)
    return []
  }
  type Raw = Omit<TournamentMatchRow, 'player_a_name' | 'player_b_name'>
  const rows = (data ?? []) as Raw[]

  // Collect all player IDs to look up usernames in one round-trip.
  const ids = new Set<string>()
  for (const m of rows) {
    if (m.player_a_id) ids.add(m.player_a_id)
    if (m.player_b_id) ids.add(m.player_b_id)
  }
  let nameById = new Map<string, string>()
  if (ids.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', Array.from(ids))
    for (const p of (profiles ?? []) as Array<{ id: string; username: string }>) {
      nameById.set(p.id, p.username)
    }
  }

  return rows.map((m) => ({
    ...m,
    player_a_name: m.player_a_id ? nameById.get(m.player_a_id) ?? null : null,
    player_b_name: m.player_b_id ? nameById.get(m.player_b_id) ?? null : null,
  }))
}

// ── Creation + seeding ───────────────────────────────────────────────────────

export type CreateTournamentInput = {
  name: string
  bracketSize: BracketSize
  startsAt: string
  registrationClosesAt: string
}

export async function createTournament(
  input: CreateTournamentInput,
  creatorId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'supabase not configured' }
  if (!isValidBracketSize(input.bracketSize)) return { ok: false, error: 'invalid bracket size' }
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: input.name,
      bracket_size: input.bracketSize,
      starts_at: input.startsAt,
      registration_closes_at: input.registrationClosesAt,
      status: 'registration',
      created_by: creatorId,
    })
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false, error: error?.message ?? 'insert failed' }
  return { ok: true, id: data.id as string }
}

// Seed a tournament: shuffle registered players, create round-1 matches,
// flip status to 'active'. Only the creator should call this — RLS enforces.
export async function seedTournament(
  tournamentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'supabase not configured' }
  const t = await fetchTournament(tournamentId)
  if (!t) return { ok: false, error: 'tournament not found' }
  if (t.status !== 'registration' && t.status !== 'upcoming') {
    return { ok: false, error: 'tournament already started' }
  }
  const regs = await fetchRegistrations(tournamentId)
  if (regs.length < 2) return { ok: false, error: 'need at least 2 players' }
  if (regs.length > t.bracket_size) return { ok: false, error: 'too many players for bracket' }

  // Random seeding for MVP — shuffle by joined order.
  const playerIds = regs.map((r) => r.player_id)
  const round1 = planRound1(playerIds, t.bracket_size)

  // Build all bracket slot rows: round 1 has players, later rounds are empty.
  const allRows: Array<{
    tournament_id: string
    round: number
    slot: number
    player_a_id: string | null
    player_b_id: string | null
    status: 'pending' | 'ready'
  }> = []
  for (const m of round1) {
    const ready = m.playerA !== null && m.playerB !== null
    allRows.push({
      tournament_id: tournamentId,
      round: 1,
      slot: m.slot,
      player_a_id: m.playerA,
      player_b_id: m.playerB,
      status: ready ? 'ready' : 'pending',
    })
  }
  // Empty slots for rounds 2..N — they fill in as winners advance.
  const totalRounds = Math.log2(t.bracket_size)
  for (let r = 2; r <= totalRounds; r++) {
    const slotsInRound = t.bracket_size / Math.pow(2, r)
    for (let s = 0; s < slotsInRound; s++) {
      allRows.push({
        tournament_id: tournamentId,
        round: r,
        slot: s,
        player_a_id: null,
        player_b_id: null,
        status: 'pending',
      })
    }
  }

  // Insert matches, then flip tournament to 'active'.
  const { error: insertErr } = await supabase.from('tournament_matches').insert(allRows)
  if (insertErr) return { ok: false, error: insertErr.message }

  const { error: updateErr } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)
  if (updateErr) return { ok: false, error: updateErr.message }

  return { ok: true }
}

// Report a match winner. The DB trigger propagates the winner to the next slot
// and closes the tournament when the final is decided.
export async function reportMatchWinner(
  matchRowId: string,
  winnerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'supabase not configured' }
  const { error } = await supabase
    .from('tournament_matches')
    .update({ winner_id: winnerId })
    .eq('id', matchRowId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function statusLabel(s: TournamentStatus): string {
  // Returns the i18n key; callers resolve via useT().
  switch (s) {
    case 'upcoming':     return 'tour.statusUpcoming'
    case 'registration': return 'tour.statusRegistration'
    case 'active':       return 'tour.statusActive'
    case 'finished':     return 'tour.statusFinished'
    case 'cancelled':    return 'tour.statusCancelled'
  }
}
