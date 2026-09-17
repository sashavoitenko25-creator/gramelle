-- LIVE Roulette tables for Gramelle
create table if not exists public.roulette_rounds (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('betting', 'spinning', 'settled')),
  bet_ends_at timestamptz not null,
  spin_ends_at timestamptz,
  result_ends_at timestamptz,
  server_seed_hash text not null,
  server_seed text,
  result_slot int,
  result_color text check (result_color is null or result_color in ('red', 'black', 'green')),
  created_at timestamptz not null default now()
);

create index if not exists roulette_rounds_created_idx on public.roulette_rounds (created_at desc);
create index if not exists roulette_rounds_status_idx on public.roulette_rounds (status);

create table if not exists public.roulette_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.roulette_rounds(id) on delete cascade,
  telegram_id bigint not null,
  username text not null default '',
  color text not null check (color in ('red', 'black', 'green')),
  amount numeric(18, 6) not null check (amount > 0),
  payout numeric(18, 6),
  created_at timestamptz not null default now()
);

create index if not exists roulette_bets_round_idx on public.roulette_bets (round_id);
create index if not exists roulette_bets_user_round_idx on public.roulette_bets (telegram_id, round_id);

alter table public.roulette_rounds enable row level security;
alter table public.roulette_bets enable row level security;
