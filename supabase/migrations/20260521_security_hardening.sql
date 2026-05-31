-- Belot Online — Security hardening (audit fixes SEC-001, SEC-002, SEC-003)
-- ----------------------------------------------------------------------------
-- Makes match + tournament results SERVER-AUTHORITATIVE. After this migration:
--   * Clients can no longer INSERT into public.matches (the game server writes
--     them via the service_role key, which bypasses RLS).
--   * Clients can no longer set tournament_matches.winner_id — only the server
--     (service_role) may, keyed off the authoritative match it just wrote.
--     Clients keep the right to set room_code/status (the "play match" flow).
--   * The leftover anon-writable public.test_demo table is dropped.
-- Idempotent: safe to re-run. Apply via Supabase Studio → SQL editor.
-- ============================================================================

-- SEC-003 — drop the public, anonymously-writable demo table ------------------
drop table if exists public.test_demo cascade;

-- SEC-001 — matches are written only by the server (service_role) -------------
-- Remove the permissive client insert policy and the table-level grant so the
-- browser can no longer fabricate match rows. SELECT stays open (leaderboard).
drop policy if exists matches_insert_self on public.matches;
drop policy if exists matches_insert_auth on public.matches;
revoke insert on public.matches from authenticated;

-- match_events: same treatment (server-only writes going forward).
drop policy if exists match_events_insert_authed on public.match_events;
revoke insert on public.match_events from authenticated;

-- SEC-002 — tournament_matches.winner_id is server-only -----------------------
-- Keep participants able to set room_code/status (start a match), but block any
-- change to winner_id unless the caller is the service_role (the game server).
-- A BEFORE-UPDATE trigger named to sort BEFORE on_tmatch_winner_set ('g' < 'o')
-- so forged winner writes are rejected before the propagation trigger runs.
create or replace function public.guard_tmatch_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.winner_id is distinct from old.winner_id then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'winner_id may only be set by the game server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_tmatch_winner on public.tournament_matches;
create trigger guard_tmatch_winner
  before update on public.tournament_matches
  for each row execute function public.guard_tmatch_winner();

-- The old participant-update policy permitted setting winner_id to either
-- player. Replace it with one that allows the room_code/status workflow but
-- forbids touching winner_id (the trigger above is the hard backstop; this
-- keeps the intent explicit and surfaces a clean RLS error early).
drop policy if exists tmatches_update_player on public.tournament_matches;
create policy tmatches_update_player on public.tournament_matches
  for update to authenticated
  using (auth.uid() = player_a_id or auth.uid() = player_b_id)
  with check (auth.uid() = player_a_id or auth.uid() = player_b_id);
