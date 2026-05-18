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

  const { error } = await supabase.from('matches').insert({
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

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[matchPersist] insert failed:', error.message)
  }
}
