-- Gramelle: remove Spin-only schema (RPS + wallet stay)
-- Project: xrfjqiiajtxykeuotucw
-- Run once in Supabase SQL Editor. Safe if tables already gone.

-- 1) Drop Spin tables (order: children first)
drop table if exists public.round_bets cascade;
drop table if exists public.rounds cascade;
drop table if exists public.game_history cascade;

-- 2) Optional: drop unused sequences / helpers if you created any for spin
-- (ignore errors if not present)
drop sequence if exists public.roll_id_seq cascade;
drop sequence if exists public.room_seq_classic_seq cascade;
drop sequence if exists public.room_seq_high_seq cascade;

-- 3) Ensure RPS + money tables exist (no-op if already created)
create table if not exists public.rps_rooms (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open',
  amount numeric not null,
  creator_telegram_id bigint not null,
  creator_username text,
  creator_photo_url text,
  creator_choice text,
  creator_choice_hash text,
  creator_nonce text,
  joiner_telegram_id bigint,
  joiner_username text,
  joiner_photo_url text,
  joiner_choice text,
  server_seed text,
  server_seed_hash text,
  reveal_at timestamptz,
  finished_at timestamptz,
  winner_telegram_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.rps_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid,
  telegram_id bigint not null,
  opponent text,
  my_choice text,
  opponent_choice text,
  amount numeric not null,
  result text not null,
  payout numeric not null default 0,
  server_seed text,
  server_seed_hash text,
  creator_choice_hash text,
  created_at timestamptz not null default now()
);

create index if not exists rps_rooms_status_idx on public.rps_rooms(status);
create index if not exists rps_rooms_creator_idx on public.rps_rooms(creator_telegram_id);
create index if not exists rps_history_tg_idx on public.rps_history(telegram_id, created_at desc);

create table if not exists public.ton_deposits (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  amount_ton numeric not null,
  amount_gram numeric not null,
  memo text not null,
  status text not null default 'pending',
  tx_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  completed_at timestamptz
);

create index if not exists ton_deposits_memo_idx on public.ton_deposits(memo);
create index if not exists ton_deposits_tg_status_idx on public.ton_deposits(telegram_id, status);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  task_id text not null,
  created_at timestamptz not null default now(),
  unique (telegram_id, task_id)
);

-- 4) Profiles columns used by app (safe adds)
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists biggest_win numeric default 0;
alter table public.profiles add column if not exists wins int default 0;
alter table public.profiles add column if not exists games int default 0;
alter table public.profiles add column if not exists ton_wallet text;
alter table public.profiles add column if not exists ref_turnover numeric default 0;
alter table public.profiles add column if not exists ref_active int default 0;
alter table public.profiles add column if not exists balance_version int default 0;
alter table public.profiles add column if not exists wager_remaining numeric default 0;
alter table public.profiles add column if not exists banned boolean default false;

-- 5) Optional: hide old spin refunds noise is app-side; ledger history kept for audit

-- 6) Verify what remains
-- select table_name from information_schema.tables
-- where table_schema = 'public' order by 1;
