-- Belot Online — Phase D: Tournaments
-- ----------------------------------------------------------------------------
-- Creates:
--   1. public.tournaments              — tournament metadata (single-elim only)
--   2. public.tournament_registrations — who signed up for which tournament
--   3. public.tournament_matches       — bracket slots + match results
-- ----------------------------------------------------------------------------
-- Idempotent: drops and recreates RLS policies; uses IF NOT EXISTS for tables.
-- Apply via Supabase Studio → SQL editor.
-- ============================================================================

-- 1. TOURNAMENTS -------------------------------------------------------------
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

comment on table public.tournaments is 'Single-elimination tournaments. status drives UI state machine.';

create index if not exists tournaments_status_idx       on public.tournaments (status, starts_at);
create index if not exists tournaments_starts_at_idx    on public.tournaments (starts_at desc);

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- 2. TOURNAMENT REGISTRATIONS ------------------------------------------------
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

-- 3. TOURNAMENT MATCHES (bracket slots) --------------------------------------
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

comment on table public.tournament_matches is 'One row per bracket slot. round=1 is first round; slot is 0-indexed within the round.';

create index if not exists tmatches_tournament_idx     on public.tournament_matches (tournament_id, round, slot);
create index if not exists tmatches_room_idx           on public.tournament_matches (room_code);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
alter table public.tournaments              enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournament_matches       enable row level security;

-- Tournaments: readable by everyone. Writes go through service role (admin)
-- or via a future creator-only insert policy. For MVP we allow signed-in users
-- to create tournaments so friends can run their own brackets.
drop policy if exists tournaments_select_all on public.tournaments;
create policy tournaments_select_all on public.tournaments
  for select to anon, authenticated using (true);

drop policy if exists tournaments_insert_self on public.tournaments;
create policy tournaments_insert_self on public.tournaments
  for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists tournaments_update_creator on public.tournaments;
create policy tournaments_update_creator on public.tournaments
  for update to authenticated
  using (auth.uid() = created_by);

drop policy if exists tournaments_delete_creator on public.tournaments;
create policy tournaments_delete_creator on public.tournaments
  for delete to authenticated
  using (auth.uid() = created_by and status = 'upcoming');

-- Registrations: readable by all, players manage their own.
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

-- Tournament matches: readable by all. Writes via server (service role)
-- or by players reporting their own match results (next migration if needed).
drop policy if exists tmatches_select_all on public.tournament_matches;
create policy tmatches_select_all on public.tournament_matches
  for select to anon, authenticated using (true);

-- Allow either of the two players in the match to mark themselves as the winner.
-- Server-side advancement (winner propagation) is handled by a separate trigger
-- below or by the application layer.
drop policy if exists tmatches_update_player on public.tournament_matches;
create policy tmatches_update_player on public.tournament_matches
  for update to authenticated
  using (
    auth.uid() = player_a_id
    or auth.uid() = player_b_id
  )
  with check (
    -- Players may only set winner_id to one of the two participants.
    winner_id is null
    or winner_id = player_a_id
    or winner_id = player_b_id
  );

-- ============================================================================
-- VIEW — tournament listings with registration counts
-- ============================================================================
create or replace view public.tournament_listings as
select
  t.id,
  t.name,
  t.format,
  t.bracket_size,
  t.status,
  t.starts_at,
  t.registration_closes_at,
  t.created_by,
  t.winner_id,
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

comment on view public.tournament_listings is 'Tournament list with pre-computed registration counts.';

grant select on public.tournaments              to anon, authenticated;
grant select on public.tournament_registrations to anon, authenticated;
grant select on public.tournament_matches       to anon, authenticated;
grant select on public.tournament_listings      to anon, authenticated;

-- ============================================================================
-- TRIGGER — propagate winner to the next bracket round
-- ============================================================================
-- When tournament_matches.winner_id is set and the match is in round N,
-- write the winner into round (N+1)'s slot ⌊slot/2⌋, as player_a if the
-- finishing match's slot is even, player_b if odd. Also closes out the
-- tournament when the final round's winner is set.
create or replace function public.propagate_tournament_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_round int;
  next_slot  int;
  parent_field text;
  bracket_size int;
  max_round    int;
begin
  -- Only act when winner_id transitions from null → not null.
  if new.winner_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.winner_id is not distinct from new.winner_id then
    return new;
  end if;

  -- Mark this match finished.
  new.status      := 'finished';
  new.finished_at := coalesce(new.finished_at, now());

  -- Look up bracket size to know whether this is the final.
  select t.bracket_size into bracket_size
    from public.tournaments t where t.id = new.tournament_id;
  if not found then return new; end if;

  -- Final round = log2(bracket_size). 4→2, 8→3, 16→4, 32→5.
  max_round := case bracket_size when 4 then 2 when 8 then 3
                                 when 16 then 4 when 32 then 5 else 0 end;

  if new.round >= max_round then
    -- Tournament complete — record overall winner.
    update public.tournaments
       set winner_id = new.winner_id,
           status    = 'finished',
           updated_at = now()
     where id = new.tournament_id;
    return new;
  end if;

  next_round := new.round + 1;
  next_slot  := new.slot / 2;          -- integer division
  parent_field := case when (new.slot % 2) = 0 then 'A' else 'B' end;

  if parent_field = 'A' then
    update public.tournament_matches
       set player_a_id = new.winner_id,
           status      = case
                          when player_b_id is not null then 'ready'
                          else 'pending'
                        end
     where tournament_id = new.tournament_id
       and round = next_round
       and slot  = next_slot;
  else
    update public.tournament_matches
       set player_b_id = new.winner_id,
           status      = case
                          when player_a_id is not null then 'ready'
                          else 'pending'
                        end
     where tournament_id = new.tournament_id
       and round = next_round
       and slot  = next_slot;
  end if;

  return new;
end;
$$;

drop trigger if exists on_tmatch_winner_set on public.tournament_matches;
create trigger on_tmatch_winner_set
  before update on public.tournament_matches
  for each row execute function public.propagate_tournament_winner();
