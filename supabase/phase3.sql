-- Phase 3 migration — run in Supabase SQL Editor after schema.sql + phase2.sql

-- Withdrawals (TON only)
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  profile_id uuid references profiles(id),
  amount_gram numeric not null,
  amount_ton numeric not null,
  wallet_address text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'rejected')),
  admin_note text,
  tx_hash text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists withdrawals_telegram_id_idx on withdrawals(telegram_id);
create index if not exists withdrawals_status_idx on withdrawals(status);

alter table withdrawals enable row level security;
-- no anon policies — service role only

-- Profile stats for UX
alter table profiles add column if not exists photo_url text;
alter table profiles add column if not exists biggest_win numeric not null default 0;
alter table profiles add column if not exists wins int not null default 0;
alter table profiles add column if not exists games int not null default 0;

-- Optional app_settings for rates (read by server; write via SQL/admin)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('rates', '{"gram_per_star": 1, "gram_per_ton": 1}'::jsonb),
  ('limits', '{"min_withdraw_ton": 1, "max_withdraw_ton": 200, "referral_deposit_pct": 0.05}'::jsonb)
on conflict (key) do nothing;
