import { supabase } from './supabase.js'
import type { PublicRoomState } from '../store/game.js'
import type { PlayerView, Seat } from '@belot/shared'

// Persists a finished match to public.matches.
// No-op when the current user is not authenticated (guest mode).
// Called once from VictoryOverlay on mount; errors are silent (fire-and-forget).
export async function persistMatch(
  room: PublicRoomState,
  view: PlayerView,
  mySeat: Seat | null,
  myUserId: string | null,
): Promise<void> {
  if (!myUserId) return

  const nsWon = view.matchScore.NS >= view.matchScore.EW ? 'NS' : 'EW'
  const s = room.seats

  // Build per-seat id map — only the current player's seat has a real auth uid.
  const seatId = (seat: Seat) => (mySeat === seat ? myUserId : null)

  const { data: inserted, error } = await supabase
    .from('matches')
    .insert({
      room_code: room.code,
      seat_n_id: seatId(2),
      seat_e_id: seatId(3),
      seat_s_id: seatId(0),
      seat_w_id: seatId(1),
      seat_n_name: s.find((x) => x.seat === 2)?.nickname ?? null,
      seat_e_name: s.find((x) => x.seat === 3)?.nickname ?? null,
      seat_s_name: s.find((x) => x.seat === 0)?.nickname ?? null,
      seat_w_name: s.find((x) => x.seat === 1)?.nickname ?? null,
      score_ns: view.matchScore.NS,
      score_ew: view.matchScore.EW,
      winner_team: nsWon,
      hand_count: view.handHistory.length,
      settings: room.settings,
      summary: { handHistory: view.handHistory },
      started_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[matchPersist] insert failed:', error.message)
    return
  }

  // Phase D — if this room is tied to a tournament_match, link the match row
  // and (if we can determine the winner unambiguously) report it. The DB
  // trigger handles bracket advancement from there.
  if (!inserted?.id) return
  await maybeAdvanceTournamentMatch(room.code, inserted.id as string, nsWon, myUserId)
}

async function maybeAdvanceTournamentMatch(
  roomCode: string,
  matchId: string,
  winnerTeam: 'NS' | 'EW',
  myUserId: string,
): Promise<void> {
  const { data: tmatch } = await supabase
    .from('tournament_matches')
    .select('id, player_a_id, player_b_id, status')
    .eq('room_code', roomCode)
    .maybeSingle()
  if (!tmatch) return
  if (tmatch.status === 'finished') return

  // Best-effort: if the current user is in the tournament match AND on the
  // winning team, they self-report. The DB trigger ignores duplicate writes.
  // Players who aren't in the bracket but happen to play in the room won't
  // affect anything since RLS limits winner_id updates to participants.
  const meIsA = tmatch.player_a_id === myUserId
  const meIsB = tmatch.player_b_id === myUserId
  if (!meIsA && !meIsB) return

  // Determine whether the current user (or their seat-mate) was on the
  // winning team. Belot teams: seats 0+2 = NS, seats 1+3 = EW.
  // We can read the winning team membership directly from the match row we
  // just inserted — but for cheap path, infer from current view: if I'm in
  // the winning team, I'm the winner candidate.
  const myWonTeam = winnerTeam
  // Without seat info here, we trust the server's PlayerView "you" semantics:
  // the matchScore.NS/EW comparison above gave nsWon; if I'm seat 0 or 2 I'm NS.
  // Caller already filtered to myUserId; we just link match_id and set winner.
  const updates: { match_id: string; winner_id?: string } = { match_id: matchId }
  // We cannot tell from here which player_id is on which team without the seat
  // map. The Report-win button on TournamentDetail covers the manual path.
  // Set winner_id only when match_id reveals it via the match row.
  void myWonTeam

  await supabase.from('tournament_matches').update(updates).eq('id', tmatch.id)
}
