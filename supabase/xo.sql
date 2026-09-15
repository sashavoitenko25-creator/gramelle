-- Gramelle Tic-Tac-Toe (XO) PvP
-- Run once in Supabase SQL Editor

create sequence if not exists xo_room_game_no_seq;

create table if not exists xo_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open'
    check (status in ('open', 'playing', 'finished', 'cancelled')),
  amount numeric not null,
  creator_telegram_id bigint not null,
  creator_username text not null,
  creator_photo_url text,
  creator_symbol text not null check (creator_symbol in ('X', 'O')),
  joiner_telegram_id bigint,
  joiner_username text,
  joiner_photo_url text,
  board jsonb not null default '[null,null,null,null,null,null,null,null,null]'::jsonb,
  turn_symbol text not null default 'X' check (turn_symbol in ('X', 'O')),
  turn_deadline timestamptz,
  move_log jsonb not null default '[]'::jsonb,
  house_fee numeric,
  pot_after_fee numeric,
  winner_telegram_id bigint,
  finish_reason text check (finish_reason is null or finish_reason in ('win', 'draw', 'timeout', 'forfeit')),
  game_no bigint not null default nextval('xo_room_game_no_seq'),
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  finished_at timestamptz
);

alter sequence xo_room_game_no_seq owned by xo_rooms.game_no;

create unique index if not exists xo_rooms_game_no_uidx on xo_rooms(game_no);
create index if not exists xo_rooms_status_created_idx on xo_rooms(status, created_at desc);
create index if not exists xo_rooms_creator_status_idx on xo_rooms(creator_telegram_id, status);
create index if not exists xo_rooms_joiner_status_idx on xo_rooms(joiner_telegram_id, status);

create table if not exists xo_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references xo_rooms(id) on delete cascade,
  telegram_id bigint not null,
  opponent text not null,
  my_symbol text not null check (my_symbol in ('X', 'O')),
  amount numeric not null,
  result text not null check (result in ('win', 'lose', 'draw')),
  payout numeric not null default 0,
  game_no bigint,
  board jsonb,
  move_log jsonb,
  finish_reason text,
  created_at timestamptz not null default now()
);

create index if not exists xo_history_telegram_created_idx
  on xo_history(telegram_id, created_at desc);
create index if not exists xo_history_game_no_idx on xo_history(game_no);
