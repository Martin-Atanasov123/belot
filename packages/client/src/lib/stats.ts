import { supabase, isSupabaseConfigured } from './supabase.js'

// Phase C — read-side stats helpers for Profile, Leaderboard, and Tablo sidebar.
// All functions are tolerant of unconfigured Supabase (return empty / null) so
// guest mode still renders.

export type LeaderboardScope = 'weekly' | 'monthly' | 'all'

export type LeaderboardRow = {
  player_id: string
  username: string
  games_played: number
  games_won: number
  games_lost: number
  win_pct: number
}

export type ProfileRow = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  is_premium: boolean
  created_at: string
}

export type MatchRow = {
  id: string
  room_code: string
  seat_n_id: string | null
  seat_e_id: string | null
  seat_s_id: string | null
  seat_w_id: string | null
  seat_n_name: string | null
  seat_e_name: string | null
  seat_s_name: string | null
  seat_w_name: string | null
  score_ns: number
  score_ew: number
  winner_team: 'NS' | 'EW'
  hand_count: number
  finished_at: string
}

export type ProfileStats = {
  wins: number
  losses: number
  winRate: number
  streak: number
  totalGames: number
  winsLast7Days: number
}

// ── Leaderboard ─────────────────────────────────────────────────────────

async function fetchAllTime(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('player_id, username, games_played, games_won, games_lost, win_pct')
    .limit(100)
  if (error) {
    console.warn('[stats] leaderboard view:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    player_id: r.player_id as string,
    username: r.username as string,
    games_played: Number(r.games_played),
    games_won: Number(r.games_won),
    games_lost: Number(r.games_lost),
    win_pct: Number(r.win_pct ?? 0),
  }))
}

async function fetchWindow(sinceTs: string): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('seat_n_id, seat_e_id, seat_s_id, seat_w_id, winner_team')
    .gte('finished_at', sinceTs)
    .limit(2000)
  if (error || !data) {
    console.warn('[stats] matches window:', error?.message)
    return []
  }
  const byId = new Map<string, { played: number; won: number }>()
  const bump = (id: string | null, isWin: boolean) => {
    if (!id) return
    const r = byId.get(id) ?? { played: 0, won: 0 }
    r.played++
    if (isWin) r.won++
    byId.set(id, r)
  }
  for (const m of data as MatchRow[]) {
    bump(m.seat_n_id, m.winner_team === 'NS')
    bump(m.seat_s_id, m.winner_team === 'NS')
    bump(m.seat_e_id, m.winner_team === 'EW')
    bump(m.seat_w_id, m.winner_team === 'EW')
  }
  const ids = Array.from(byId.keys())
  if (ids.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', ids)
  const nameById = new Map<string, string>()
  for (const p of (profiles ?? []) as Array<{ id: string; username: string }>) {
    nameById.set(p.id, p.username)
  }

  const rows: LeaderboardRow[] = []
  for (const [id, r] of byId.entries()) {
    rows.push({
      player_id: id,
      username: nameById.get(id) ?? '—',
      games_played: r.played,
      games_won: r.won,
      games_lost: r.played - r.won,
      win_pct: r.played > 0 ? Math.round((1000 * r.won) / r.played) / 10 : 0,
    })
  }
  rows.sort((a, b) => b.games_won - a.games_won || b.win_pct - a.win_pct)
  return rows.slice(0, 100)
}

export async function fetchLeaderboard(scope: LeaderboardScope): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return []
  if (scope === 'all') return fetchAllTime()
  const days = scope === 'weekly' ? 7 : 30
  const sinceTs = new Date(Date.now() - days * 86400000).toISOString()
  return fetchWindow(sinceTs)
}

// ── Profile lookup ──────────────────────────────────────────────────────

export async function fetchProfileByUsername(username: string): Promise<ProfileRow | null> {
  if (!isSupabaseConfigured || !username) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_premium, created_at')
    .ilike('username', username)
    .maybeSingle()
  if (error) {
    console.warn('[stats] profile:', error.message)
    return null
  }
  return (data as ProfileRow | null) ?? null
}

export async function fetchProfileMatches(profileId: string, limit = 20): Promise<MatchRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, room_code, seat_n_id, seat_e_id, seat_s_id, seat_w_id, seat_n_name, seat_e_name, seat_s_name, seat_w_name, score_ns, score_ew, winner_team, hand_count, finished_at',
    )
    .or(
      `seat_n_id.eq.${profileId},seat_e_id.eq.${profileId},seat_s_id.eq.${profileId},seat_w_id.eq.${profileId}`,
    )
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[stats] matches:', error.message)
    return []
  }
  return (data ?? []) as MatchRow[]
}

// ── Stats math (pure) ───────────────────────────────────────────────────

export function playerTeam(
  m: Pick<MatchRow, 'seat_n_id' | 'seat_e_id' | 'seat_s_id' | 'seat_w_id'>,
  id: string,
): 'NS' | 'EW' | null {
  if (m.seat_n_id === id || m.seat_s_id === id) return 'NS'
  if (m.seat_e_id === id || m.seat_w_id === id) return 'EW'
  return null
}

export function computeStats(profileId: string, matches: MatchRow[]): ProfileStats {
  let wins = 0
  let losses = 0
  let winsLast7Days = 0
  const cutoff = Date.now() - 7 * 86400000

  for (const m of matches) {
    const t = playerTeam(m, profileId)
    if (!t) continue
    const won = t === m.winner_team
    if (won) {
      wins++
      if (new Date(m.finished_at).getTime() >= cutoff) winsLast7Days++
    } else {
      losses++
    }
  }

  // Streak — read from most-recent backwards; positive = win streak, negative = loss streak.
  let streak = 0
  if (matches.length > 0) {
    const first = matches[0]!
    const firstTeam = playerTeam(first, profileId)
    if (firstTeam !== null) {
      const firstWon = firstTeam === first.winner_team
      for (const m of matches) {
        const t = playerTeam(m, profileId)
        if (t === null) break
        const won = t === m.winner_team
        if (won !== firstWon) break
        streak += firstWon ? 1 : -1
      }
    }
  }

  const total = wins + losses
  return {
    wins,
    losses,
    winRate: total > 0 ? Math.round((100 * wins) / total) : 0,
    streak,
    totalGames: total,
    winsLast7Days,
  }
}
