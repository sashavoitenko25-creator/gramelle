-- Gramelle Dice PvP (Arizona-style table) — run in Supabase SQL editor

create table if not exists dice_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open', 'playing', 'finished', 'cancelled')),
  host_telegram_id bigint not null,
  amount numeric not null check (amount > 0),
  max_players int not null default 2 check (max_players between 2 and 6),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'rolling', 'finished')),
  round int not null default 0,
  turn_seat int,
  server_seed text not null,
  server_seed_hash text not null,
  pot numeric,
  house_fee numeric,
  winner_telegram_id bigint,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists dice_rooms_status_idx on dice_rooms(status);
create index if not exists dice_rooms_host_idx on dice_rooms(host_telegram_id);
create index if not exists dice_rooms_created_idx on dice_rooms(created_at desc);

create table if not exists dice_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references dice_rooms(id) on delete cascade,
  seat int not null check (seat between 0 and 5),
  telegram_id bigint not null,
  username text not null,
  photo_url text,
  active boolean not null default true,
  die1 int check (die1 is null or (die1 between 1 and 6)),
  die2 int check (die2 is null or (die2 between 1 and 6)),
  sum int,
  has_rolled boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, seat),
  unique (room_id, telegram_id)
);

create index if not exists dice_players_room_idx on dice_players(room_id);
create index if not exists dice_players_tg_idx on dice_players(telegram_id);

alter table dice_rooms enable row level security;
alter table dice_players enable row level security;

drop policy if exists "public read dice_rooms" on dice_rooms;
create policy "public read dice_rooms" on dice_rooms for select using (true);

drop policy if exists "public read dice_players" on dice_players;
create policy "public read dice_players" on dice_players for select using (true);
