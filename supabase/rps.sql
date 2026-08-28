-- Gramelle RPS rooms — run in Supabase SQL editor after main schema

create table if not exists rps_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open', 'playing', 'finished', 'cancelled')),

  -- Creator (player A)
  creator_telegram_id bigint not null,
  creator_username text not null,
  creator_photo_url text,
  creator_choice text not null check (creator_choice in ('rock', 'paper', 'scissors')),
  creator_choice_nonce text not null,
  creator_choice_hash text not null,

  -- Joiner (player B) — null until joined
  joiner_telegram_id bigint,
  joiner_username text,
  joiner_photo_url text,
  joiner_choice text check (joiner_choice is null or joiner_choice in ('rock', 'paper', 'scissors')),

  amount numeric not null check (amount > 0),
  house_fee numeric,
  pot_after_fee numeric,
  winner_telegram_id bigint, -- null = draw

  server_seed text not null,
  server_seed_hash text not null,

  created_at timestamptz not null default now(),
  joined_at timestamptz,
  finished_at timestamptz,
  reveal_at timestamptz -- when animation should finish / result is official
);

create index if not exists rps_rooms_status_idx on rps_rooms(status);
create index if not exists rps_rooms_creator_idx on rps_rooms(creator_telegram_id);
create index if not exists rps_rooms_joiner_idx on rps_rooms(joiner_telegram_id);
create index if not exists rps_rooms_created_idx on rps_rooms(created_at desc);

-- Public read for lobby (open rooms + recent finished)
alter table rps_rooms enable row level security;

drop policy if exists "public read rps_rooms" on rps_rooms;
create policy "public read rps_rooms" on rps_rooms for select using (true);

-- History rows for RPS (reuse game_history with type in meta, or dedicated)
create table if not exists rps_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rps_rooms(id) on delete set null,
  telegram_id bigint not null,
  opponent text not null,
  my_choice text not null,
  opponent_choice text not null,
  amount numeric not null,
  result text not null check (result in ('win', 'lose', 'draw')),
  payout numeric not null default 0,
  server_seed text,
  server_seed_hash text,
  creator_choice_hash text,
  created_at timestamptz not null default now()
);

create index if not exists rps_history_telegram_idx on rps_history(telegram_id);
create index if not exists rps_history_created_idx on rps_history(created_at desc);

alter table rps_history enable row level security;
drop policy if exists "public read rps_history" on rps_history;
create policy "public read rps_history" on rps_history for select using (true);
