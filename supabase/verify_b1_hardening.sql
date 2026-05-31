-- B1 verification — is the server-authoritative hardening actually LIVE?
-- ----------------------------------------------------------------------------
-- Read-only. Paste into Supabase Studio -> SQL editor and run. Every row should
-- read PASS. Any FAIL means 20260521_security_hardening.sql was never applied
-- (or was later weakened) on this database, and results are forgeable.
-- ============================================================================

with checks as (
  -- SEC-003 — the anon-writable demo table must be gone.
  select
    'SEC-003 test_demo dropped' as check_name,
    (to_regclass('public.test_demo') is null) as ok,
    coalesce(to_regclass('public.test_demo')::text, '(absent)') as detail

  union all
  -- SEC-001 — anon must NOT be able to INSERT match results.
  select
    'SEC-001 matches: anon cannot INSERT',
    not has_table_privilege('anon', 'public.matches', 'INSERT'),
    'anon INSERT=' || has_table_privilege('anon', 'public.matches', 'INSERT')::text

  union all
  -- SEC-001 — authenticated must NOT be able to INSERT match results.
  select
    'SEC-001 matches: authenticated cannot INSERT',
    not has_table_privilege('authenticated', 'public.matches', 'INSERT'),
    'authenticated INSERT=' || has_table_privilege('authenticated', 'public.matches', 'INSERT')::text

  union all
  -- SEC-001 — NO insert policy of any name may remain on matches. A leftover
  -- INSERT policy is inert without the table grant, but becomes live the moment
  -- anyone re-grants INSERT — so it must not exist at all.
  select
    'SEC-001 matches has no INSERT policy',
    not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'matches'
        and cmd in ('INSERT', 'ALL')
    ),
    coalesce((select string_agg(policyname || ':' || cmd, ', ') from pg_policies
              where schemaname = 'public' and tablename = 'matches'), '(none)')

  union all
  -- Clients must still be able to READ matches (leaderboard / history).
  select
    'matches: clients can still SELECT (leaderboard)',
    has_table_privilege('anon', 'public.matches', 'SELECT')
      and has_table_privilege('authenticated', 'public.matches', 'SELECT'),
    'anon SELECT=' || has_table_privilege('anon', 'public.matches', 'SELECT')::text

  union all
  -- SEC-001 — match_events: authenticated must NOT INSERT.
  select
    'SEC-001 match_events: authenticated cannot INSERT',
    not has_table_privilege('authenticated', 'public.match_events', 'INSERT'),
    'authenticated INSERT=' || has_table_privilege('authenticated', 'public.match_events', 'INSERT')::text

  union all
  -- SEC-002 — the winner_id guard trigger must exist.
  select
    'SEC-002 guard_tmatch_winner trigger exists',
    exists (
      select 1 from pg_trigger
      where tgname = 'guard_tmatch_winner'
        and tgrelid = 'public.tournament_matches'::regclass
        and not tgisinternal
    ),
    coalesce((select string_agg(tgname, ', ') from pg_trigger
              where tgrelid = 'public.tournament_matches'::regclass and not tgisinternal), '(none)')

  union all
  -- SEC-002 — the guard function must exist.
  select
    'SEC-002 guard_tmatch_winner() function exists',
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'guard_tmatch_winner'
    ),
    'present'

  union all
  -- SEC-002 — the participant update policy must exist (room_code/status flow).
  select
    'SEC-002 tmatches_update_player policy present',
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'tournament_matches'
        and policyname = 'tmatches_update_player'
    ),
    coalesce((select string_agg(policyname, ', ') from pg_policies
              where schemaname = 'public' and tablename = 'tournament_matches'), '(none)')
)
select
  case when ok then 'PASS' else 'FAIL' end as status,
  check_name,
  detail
from checks
order by ok asc, check_name;  -- FAILs float to the top
