-- Phase C — public read access to matches & match_events
-- ----------------------------------------------------------------------------
-- Idempotent: drops and recreates the public SELECT policies so the
-- leaderboard view and profile match-history queries work for anon visitors.
-- Run this in Supabase Studio (SQL editor) on the production project.
-- ----------------------------------------------------------------------------

alter table public.matches      enable row level security;
alter table public.match_events enable row level security;

drop policy if exists matches_select_all on public.matches;
create policy matches_select_all on public.matches
  for select to anon, authenticated using (true);

drop policy if exists match_events_select_all on public.match_events;
create policy match_events_select_all on public.match_events
  for select to anon, authenticated using (true);

-- Ensure the leaderboard view is readable by anon/authenticated too.
-- (Views inherit RLS from their underlying tables, but explicit grants don't hurt.)
grant select on public.leaderboard to anon, authenticated;
grant select on public.matches      to anon, authenticated;
grant select on public.match_events to anon, authenticated;
