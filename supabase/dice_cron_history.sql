-- Dice: turn deadline for AFK auto-roll + personal history
-- Run in Supabase SQL Editor after dice.sql

alter table dice_rooms
  add column if not exists turn_deadline timestamptz;

create index if not exists dice_rooms_turn_deadline_idx
  on dice_rooms (turn_deadline)
  where status = 'playing' and phase = 'rolling';

create table if not exists dice_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  telegram_id bigint not null,
  username text not null,
  amount numeric not null,
  pot numeric not null default 0,
  house_fee numeric not null default 0,
  payout numeric not null default 0,
  result text not null check (result in ('win', 'lose')),
  server_seed text,
  server_seed_hash text,
  winner_telegram_id bigint,
  player_count int not null default 2,
  die1 int,
  die2 int,
  sum int,
  created_at timestamptz not null default now()
);

create index if not exists dice_history_telegram_idx on dice_history (telegram_id);
create index if not exists dice_history_created_idx on dice_history (created_at desc);
create index if not exists dice_history_room_idx on dice_history (room_id);

alter table dice_history enable row level security;
drop policy if exists "public read dice_history" on dice_history;
create policy "public read dice_history" on dice_history for select using (true);
