-- =============================================================================
-- Belot Online — ONE-SHOT consolidated migration
-- Apply via Supabase Studio → SQL Editor → New query → paste → Run.
-- Idempotent — safe to re-run.
-- =============================================================================
-- This script consolidates 4 fixes that the original Phase B migration missed:
--   1. PostgreSQL role-level GRANTs (RLS alone isn't enough)
--   2. matches INSERT policy (client-side matchPersist needs it)
--   3. matches SELECT to anon (public leaderboard)
--   4. Phase D tournament tables + bracket-advancement trigger
-- =============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Role-level GRANTs (the silent killer)
-- ────────────────────────────────────────────────────────────────────────────
-- Even service_role currently lacks SELECT on profiles. Grant everything the
-- three Supabase roles (anon, authenticated, service_role) need.

grant select on public.profiles to anon, authenticated, service_role;
grant insert, update on public.profiles to authenticated, service_role;

grant select, insert on public.matches      to authenticated, service_role;
grant select         on public.matches      to anon;
grant select, insert on public.match_events to authenticated, service_role;
grant select         on public.match_events to anon;
grant select         on public.leaderboard  to anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — RLS policies (Phase C bug-fix + matches insert)
-- ────────────────────────────────────────────────────────────────────────────

alter table public.matches      enable row level security;
alter table public.match_events enable row level security;

drop policy if exists matches_select_all on public.matches;
create policy matches_select_all on public.matches
  for select to anon, authenticated using (true);

drop policy if exists match_events_select_all on public.match_events;
create policy match_events_select_all on public.match_events
  for select to anon, authenticated using (true);

-- Authenticated users may insert their own match rows (they appear in ≥1 seat).
drop policy if exists matches_insert_self on public.matches;
create policy matches_insert_self on public.matches
  for insert to authenticated
  with check (
    auth.uid() = seat_n_id or auth.uid() = seat_e_id
    or auth.uid() = seat_s_id or auth.uid() = seat_w_id
  );

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

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Phase D tournament schema
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.tournaments (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (char_length(name) between 1 and 80),
  format                   text not null default 'single_elim'
                             check (format in ('single_elim')),
  bracket_size             int  not null check (bracket_size in (4, 8, 16, 32)),
  status                   text not null default 'upcoming'
                             check (status in ('upcoming', 'registration', 'active', 'finished', 'cancelled')),
  starts_at                timestamptz not null,
  registration_closes_at   timestamptz not null,
  created_by               uuid references public.profiles(id) on delete set null,
  winner_id                uuid references public.profiles(id) on delete set null,
  settings                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint reg_before_start check (registration_closes_at <= starts_at)
);

create index if not exists tournaments_status_idx    on public.tournaments (status, starts_at);
create index if not exists tournaments_starts_at_idx on public.tournaments (starts_at desc);

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

create table if not exists public.tournament_registrations (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  player_id       uuid not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  seed            int,
  unique (tournament_id, player_id)
);

create index if not exists treg_tournament_idx on public.tournament_registrations (tournament_id);
create index if not exists treg_player_idx     on public.tournament_registrations (player_id);

create table if not exists public.tournament_matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  round           int  not null check (round >= 1),
  slot            int  not null check (slot  >= 0),
  player_a_id     uuid references public.profiles(id) on delete set null,
  player_b_id     uuid references public.profiles(id) on delete set null,
  winner_id       uuid references public.profiles(id) on delete set null,
  match_id        uuid references public.matches(id)  on delete set null,
  room_code       text,
  status          text not null default 'pending'
                    check (status in ('pending', 'ready', 'active', 'finished')),
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (tournament_id, round, slot)
);

create index if not exists tmatches_tournament_idx on public.tournament_matches (tournament_id, round, slot);
create index if not exists tmatches_room_idx       on public.tournament_matches (room_code);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — Phase D RLS + grants
-- ────────────────────────────────────────────────────────────────────────────

alter table public.tournaments              enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_matches       enable row level security;

drop policy if exists tournaments_select_all on public.tournaments;
create policy tournaments_select_all on public.tournaments
  for select to anon, authenticated using (true);

drop policy if exists tournaments_insert_self on public.tournaments;
create policy tournaments_insert_self on public.tournaments
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists tournaments_update_creator on public.tournaments;
create policy tournaments_update_creator on public.tournaments
  for update to authenticated using (auth.uid() = created_by);

drop policy if exists tournaments_delete_creator on public.tournaments;
create policy tournaments_delete_creator on public.tournaments
  for delete to authenticated
  using (auth.uid() = created_by and status = 'upcoming');

drop policy if exists treg_select_all on public.tournament_registrations;
create policy treg_select_all on public.tournament_registrations
  for select to anon, authenticated using (true);

drop policy if exists treg_insert_self on public.tournament_registrations;
create policy treg_insert_self on public.tournament_registrations
  for insert to authenticated
  with check (
    auth.uid() = player_id
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and t.status in ('upcoming', 'registration')
        and now() < t.registration_closes_at
    )
  );

drop policy if exists treg_delete_self on public.tournament_registrations;
create policy treg_delete_self on public.tournament_registrations
  for delete to authenticated
  using (
    auth.uid() = player_id
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and t.status in ('upcoming', 'registration')
        and now() < t.registration_closes_at
    )
  );

drop policy if exists tmatches_select_all on public.tournament_matches;
create policy tmatches_select_all on public.tournament_matches
  for select to anon, authenticated using (true);

drop policy if exists tmatches_update_player on public.tournament_matches;
create policy tmatches_update_player on public.tournament_matches
  for update to authenticated
  using (auth.uid() = player_a_id or auth.uid() = player_b_id)
  with check (winner_id is null or winner_id = player_a_id or winner_id = player_b_id);

-- Phase D table grants
grant select                       on public.tournaments              to anon, authenticated, service_role;
grant insert, update, delete       on public.tournaments              to authenticated, service_role;
grant select                       on public.tournament_registrations to anon, authenticated, service_role;
grant insert, delete               on public.tournament_registrations to authenticated, service_role;
grant select                       on public.tournament_matches       to anon, authenticated, service_role;
grant insert, update               on public.tournament_matches       to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — Tournament listings view
-- ────────────────────────────────────────────────────────────────────────────

create or replace view public.tournament_listings as
select
  t.id, t.name, t.format, t.bracket_size, t.status, t.starts_at,
  t.registration_closes_at, t.created_by, t.winner_id,
  w.username as winner_username,
  coalesce(rc.cnt, 0) as registration_count,
  t.created_at
from public.tournaments t
left join (
  select tournament_id, count(*)::int as cnt
  from public.tournament_registrations
  group by tournament_id
) rc on rc.tournament_id = t.id
left join public.profiles w on w.id = t.winner_id;

grant select on public.tournament_listings to anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — Bracket advancement trigger
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.propagate_tournament_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bracket_size int;
  max_round    int;
begin
  if new.winner_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.winner_id is not distinct from new.winner_id then
    return new;
  end if;

  new.status      := 'finished';
  new.finished_at := coalesce(new.finished_at, now());

  select t.bracket_size into bracket_size
    from public.tournaments t where t.id = new.tournament_id;
  if not found then return new; end if;

  max_round := case bracket_size when 4 then 2 when 8 then 3
                                 when 16 then 4 when 32 then 5 else 0 end;

  if new.round >= max_round then
    update public.tournaments
       set winner_id = new.winner_id,
           status    = 'finished',
           updated_at = now()
     where id = new.tournament_id;
    return new;
  end if;

  if (new.slot % 2) = 0 then
    update public.tournament_matches
       set player_a_id = new.winner_id,
           status      = case when player_b_id is not null then 'ready' else 'pending' end
     where tournament_id = new.tournament_id
       and round = new.round + 1
       and slot  = new.slot / 2;
  else
    update public.tournament_matches
       set player_b_id = new.winner_id,
           status      = case when player_a_id is not null then 'ready' else 'pending' end
     where tournament_id = new.tournament_id
       and round = new.round + 1
       and slot  = new.slot / 2;
  end if;

  return new;
end;
$$;

drop trigger if exists on_tmatch_winner_set on public.tournament_matches;
create trigger on_tmatch_winner_set
  before update on public.tournament_matches
  for each row execute function public.propagate_tournament_winner();

-- =============================================================================
-- DONE. Verify with:  select count(*) from public.profiles;
-- =============================================================================
