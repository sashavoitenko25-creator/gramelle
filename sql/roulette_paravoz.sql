-- LIVE Roulette "Paravoz" (10-in-a-row color streak bonus)

create table if not exists public.roulette_paravoz (
  telegram_id bigint primary key,
  streak int not null default 0 check (streak >= 0),
  colors jsonb not null default '[]'::jsonb,
  username text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.roulette_paravoz_wins (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  username text not null default '',
  streak int not null default 10,
  bonus_gram numeric(18, 6) not null default 10,
  colors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists roulette_paravoz_wins_created_idx
  on public.roulette_paravoz_wins (created_at desc);

alter table public.roulette_paravoz enable row level security;
alter table public.roulette_paravoz_wins enable row level security;
