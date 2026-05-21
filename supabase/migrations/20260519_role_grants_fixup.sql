-- Phase B/C/D — role-level GRANT fix-up.
-- ----------------------------------------------------------------------------
-- Supabase's `anon` and `authenticated` PostgreSQL roles need explicit GRANT
-- privileges at the table level — even when an RLS policy would permit the
-- action. Without the GRANT, queries fail with `42501 permission denied`
-- BEFORE RLS is consulted. The original Phase B migration omitted these for
-- public.profiles (and Phase B/C/D omitted INSERT/UPDATE/DELETE grants where
-- needed). This migration patches the gaps. Safe to re-run.
-- ============================================================================

-- profiles ───────────────────────────────────────────────────────────────────
-- Public usernames need anon read for the /profil/:username route to work.
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- matches ────────────────────────────────────────────────────────────────────
-- SELECT was granted by 20260518_phase_c_matches_select_policy.sql.
-- INSERT is required so the client's matchPersist.ts can save finished games.
grant insert on public.matches to authenticated;

-- match_events ───────────────────────────────────────────────────────────────
grant insert on public.match_events to authenticated;

-- tournaments and friends (Phase D) ──────────────────────────────────────────
-- SELECT was granted by the Phase D migration. Add the write grants the
-- creator + participants need.
grant insert, update, delete on public.tournaments              to authenticated;
grant insert, delete         on public.tournament_registrations to authenticated;
grant update                 on public.tournament_matches       to authenticated;
