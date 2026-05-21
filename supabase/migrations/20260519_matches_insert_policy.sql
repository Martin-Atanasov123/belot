-- Phase C bug-fix — allow authenticated users to insert their own match rows.
-- ----------------------------------------------------------------------------
-- The original init migration assumed matches were inserted via the server's
-- service_role key. In practice, `packages/client/src/lib/matchPersist.ts`
-- writes from the client using the authenticated Supabase JS client, which
-- means RLS is enforced. Without this policy, every finished match is silently
-- rejected and Leaderboard/Profile/Tablo never populate.
--
-- Policy: an authenticated user may insert a matches row if at least one of
-- the four seat_*_id columns equals their auth.uid(). This matches the client's
-- write pattern (the local player fills in only their own seat id; bots/guests
-- stay null).
--
-- Idempotent: drop + create. Apply in Supabase Studio → SQL editor.
-- ============================================================================

drop policy if exists matches_insert_self on public.matches;
create policy matches_insert_self on public.matches
  for insert to authenticated
  with check (
    auth.uid() = seat_n_id
    or auth.uid() = seat_e_id
    or auth.uid() = seat_s_id
    or auth.uid() = seat_w_id
  );

-- Same for match_events (currently unused by the client, but kept consistent
-- so future event logging from the client doesn't silently fail).
drop policy if exists match_events_insert_authed on public.match_events;
create policy match_events_insert_authed on public.match_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (auth.uid() = m.seat_n_id or auth.uid() = m.seat_e_id
          or auth.uid() = m.seat_s_id or auth.uid() = m.seat_w_id)
    )
  );
