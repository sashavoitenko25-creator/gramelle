-- Gramelle LIVE PvP Avatar Roulette
-- Run in Supabase SQL Editor after base schema.
-- Does NOT modify existing roulette_* (color) tables.

create table if not exists public.pvp_roulette_rounds (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting'
    check (status in ('waiting', 'betting', 'spinning', 'finished', 'cancelled')),
  bet_ends_at timestamptz,
  spin_ends_at timestamptz,
  result_ends_at timestamptz,
  total_bank numeric(18, 6) not null default 0,
  winner_telegram_id bigint,
  winner_amount numeric(18, 6),
  house_fee numeric(18, 6),
  result_index int,
  server_seed_hash text not null,
  server_seed text,
  created_at timestamptz not null default now()
);

create index if not exists pvp_roulette_rounds_created_idx
  on public.pvp_roulette_rounds (created_at desc);
create index if not exists pvp_roulette_rounds_status_idx
  on public.pvp_roulette_rounds (status);

create table if not exists public.pvp_roulette_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.pvp_roulette_rounds(id) on delete cascade,
  telegram_id bigint not null,
  username text not null default '',
  avatar_url text,
  amount numeric(18, 6) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (round_id, telegram_id)
);

create index if not exists pvp_roulette_bets_round_idx
  on public.pvp_roulette_bets (round_id);
create index if not exists pvp_roulette_bets_user_idx
  on public.pvp_roulette_bets (telegram_id, round_id);

alter table public.pvp_roulette_rounds enable row level security;
alter table public.pvp_roulette_bets enable row level security;

-- Service role only (same pattern as other games). No public policies.
