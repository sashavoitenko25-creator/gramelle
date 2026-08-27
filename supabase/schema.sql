-- Gramelle Phase 1 schema + RLS
-- Run in Supabase SQL editor

-- Profiles
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  balance numeric not null default 25,
  referral_code text unique,
  ref_earned numeric not null default 0,
  ref_count int not null default 0,
  telegram_id bigint unique,
  referred_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists profiles_telegram_id_idx on profiles(telegram_id);

-- Immutable ledger (all balance changes)
create table if not exists ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  telegram_id bigint,
  amount numeric not null,
  balance_after numeric not null,
  reason text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_telegram_id_idx on ledger(telegram_id);
create index if not exists ledger_reason_idx on ledger(reason);

-- Rounds
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  roll_id bigint unique not null,
  status text not null default 'open'
    check (status in ('open', 'countdown', 'spinning', 'finished')),
  server_seed_hash text not null,
  server_seed text,
  client_seed text,
  winner_telegram_id bigint,
  total_bank numeric not null default 0,
  spin_degrees numeric,
  countdown_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rounds_status_idx on rounds(status);

-- Bets in a round
create table if not exists round_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  telegram_id bigint not null,
  username text not null,
  amount numeric not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (round_id, telegram_id)
);

-- History
create table if not exists game_history (
  id uuid primary key default gen_random_uuid(),
  roll_id bigint,
  winner text,
  chance numeric,
  win_amount numeric,
  mult numeric,
  bet numeric,
  is_me boolean,
  telegram_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists game_history_telegram_id_idx on game_history(telegram_id);

-- TON deposit intents
create table if not exists ton_deposits (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  memo text unique not null,
  amount_ton numeric not null,
  amount_gram numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired')),
  tx_hash text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ton_deposits_status_idx on ton_deposits(status);

-- ========== RLS ==========
alter table profiles enable row level security;
alter table ledger enable row level security;
alter table rounds enable row level security;
alter table round_bets enable row level security;
alter table game_history enable row level security;
alter table ton_deposits enable row level security;

-- Anon key: read-only public game state (optional)
-- NO write policies for anon — all writes go through service role API

drop policy if exists "public read rounds" on rounds;
create policy "public read rounds" on rounds for select using (true);

drop policy if exists "public read round_bets" on round_bets;
create policy "public read round_bets" on round_bets for select using (true);

-- profiles / ledger / ton_deposits: no anon access (service role only)
-- If you need client read of own history later, use a secure view + auth.

-- Prevent direct balance updates even if someone bypasses (defense in depth)
-- Service role bypasses RLS by design — that is intentional for our API.
