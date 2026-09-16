-- Race Live game tables — run in Supabase SQL editor
create table if not exists public.race_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open','countdown','racing','finished','cancelled')),
  host_telegram_id bigint not null,
  ball_price numeric(18,6) not null default 0.25,
  pot numeric(18,6) not null default 0,
  server_seed text not null,
  server_seed_hash text not null,
  countdown_ends_at timestamptz,
  buy_locked boolean not null default false,
  winner_telegram_id bigint,
  winner_ball_id uuid,
  house_fee numeric(18,6),
  finish_order jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  game_no bigint
);

create index if not exists race_rooms_status_idx on public.race_rooms (status);
create index if not exists race_rooms_created_idx on public.race_rooms (created_at desc);

create table if not exists public.race_balls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.race_rooms(id) on delete cascade,
  telegram_id bigint not null,
  username text not null,
  photo_url text,
  color text not null default '#22d3ee',
  seat int not null default 0,
  finish_rank int,
  created_at timestamptz not null default now()
);

create index if not exists race_balls_room_idx on public.race_balls (room_id);
create index if not exists race_balls_tg_idx on public.race_balls (telegram_id);
