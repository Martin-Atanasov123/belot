-- Belot Online — Phase B initial schema
-- ----------------------------------------------------------------------------
-- Creates:
--   1. public.profiles       — per-user display data (username, avatar, prefs)
--   2. public.matches        — finished match summaries (one row per game)
--   3. public.match_events   — append-only hand-level events (for stats)
-- ----------------------------------------------------------------------------
-- All tables have Row-Level Security enabled. The auth.users table is managed
-- by Supabase Auth — we extend it with a public.profiles row created on signup
-- via a trigger.
-- ============================================================================

-- 1. PROFILES ----------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null
                 check (char_length(username) between 3 and 20
                        and username ~ '^[A-Za-z0-9_.-]+$'),
  display_name text,
  avatar_url   text,
  locale       text default 'bg' check (locale in ('bg', 'en')),
  is_premium   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Per-user public profile data. One row per auth.users row.';

-- Username lookup index (case-insensitive)
create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- 2. MATCHES -----------------------------------------------------------------
create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  room_code      text not null,
  -- 4 player ids (ordered N, E, S, W = seats 0,1,2,3). May be null for bots/guests.
  seat_n_id      uuid references public.profiles(id) on delete set null,
  seat_e_id      uuid references public.profiles(id) on delete set null,
  seat_s_id      uuid references public.profiles(id) on delete set null,
  seat_w_id      uuid references public.profiles(id) on delete set null,
  seat_n_name    text,
  seat_e_name    text,
  seat_s_name    text,
  seat_w_name    text,
  -- Final score (in tens, per Bulgarian Belot scoring).
  score_ns       int  not null check (score_ns >= 0),
  score_ew       int  not null check (score_ew >= 0),
  winner_team    text not null check (winner_team in ('NS', 'EW')),
  hand_count     int  not null check (hand_count > 0),
  settings       jsonb not null default '{}'::jsonb,
  -- Capot, contra, suspended pool, etc. — engine summary.
  summary        jsonb not null default '{}'::jsonb,
  started_at     timestamptz not null,
  finished_at    timestamptz not null default now()
);

create index if not exists matches_seat_n_idx on public.matches (seat_n_id);
create index if not exists matches_seat_e_idx on public.matches (seat_e_id);
create index if not exists matches_seat_s_idx on public.matches (seat_s_id);
create index if not exists matches_seat_w_idx on public.matches (seat_w_id);
create index if not exists matches_finished_at_idx on public.matches (finished_at desc);

-- 3. MATCH EVENTS ------------------------------------------------------------
-- Append-only log of per-hand events. Useful for replay + announcement stats.
create table if not exists public.match_events (
  id          bigserial primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  hand_no     int  not null,
  event_type  text not null,  -- 'BID', 'PLAY', 'TRICK_WON', 'HAND_RESULT', 'ANNOUNCE'
  seat        smallint check (seat between 0 and 3),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists match_events_match_idx on public.match_events (match_id, hand_no);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.matches       enable row level security;
alter table public.match_events  enable row level security;

-- Profiles: readable by everyone (public usernames), writable only by owner.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id);

-- Matches: readable by everyone (public leaderboard), inserts only via server.
-- The server uses the service_role key which bypasses RLS, so we don't need
-- an explicit insert policy here.
drop policy if exists matches_select_all on public.matches;
create policy matches_select_all on public.matches
  for select using (true);

drop policy if exists match_events_select_all on public.match_events;
create policy match_events_select_all on public.match_events
  for select using (true);

-- ============================================================================
-- AUTH TRIGGER — auto-create a profile row when a new user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  fallback     text;
  final        text;
begin
  -- Username preference order:
  --   1. raw_user_meta_data.username (set on email signup)
  --   2. raw_user_meta_data.preferred_username (some OAuth providers)
  --   3. local-part of the email
  --   4. random suffix
  raw_username := coalesce(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'preferred_username',
    split_part(new.email, '@', 1),
    'player'
  );
  -- Sanitize: keep only allowed chars, clip to 20.
  raw_username := regexp_replace(raw_username, '[^A-Za-z0-9_.-]', '', 'g');
  if char_length(raw_username) < 3 then
    raw_username := raw_username || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  raw_username := substr(raw_username, 1, 20);

  -- Resolve uniqueness collisions with a numeric suffix.
  final := raw_username;
  fallback := raw_username;
  for i in 1..50 loop
    exit when not exists (select 1 from public.profiles where lower(username) = lower(final));
    final := substr(fallback, 1, 18) || '_' || i::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, locale)
  values (
    new.id,
    final,
    coalesce(new.raw_user_meta_data->>'full_name', final),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'locale', 'bg')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger for profiles
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- VIEW — leaderboard (aggregated stats)
-- ============================================================================
create or replace view public.leaderboard as
with player_matches as (
  select
    p.id   as player_id,
    p.username,
    case
      when m.seat_n_id = p.id or m.seat_s_id = p.id then 'NS'
      else 'EW'
    end as team,
    case
      when (m.seat_n_id = p.id or m.seat_s_id = p.id) and m.winner_team = 'NS' then 1
      when (m.seat_e_id = p.id or m.seat_w_id = p.id) and m.winner_team = 'EW' then 1
      else 0
    end as won
  from public.profiles p
  join public.matches m
    on p.id in (m.seat_n_id, m.seat_e_id, m.seat_s_id, m.seat_w_id)
)
select
  player_id,
  username,
  count(*)             as games_played,
  sum(won)             as games_won,
  count(*) - sum(won)  as games_lost,
  case when count(*) > 0
       then round(100.0 * sum(won) / count(*), 1)
       else 0
  end as win_pct
from player_matches
group by player_id, username
order by games_won desc, win_pct desc;

comment on view public.leaderboard is 'Aggregated per-player stats from public.matches.';
