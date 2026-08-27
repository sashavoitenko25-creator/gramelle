-- Economy + referrals + house wallets
alter table profiles add column if not exists ton_wallet text;
alter table profiles add column if not exists ref_turnover numeric not null default 0;
alter table profiles add column if not exists ref_active integer not null default 0;

alter table withdrawals add column if not exists fee_gram numeric not null default 0.2;

create table if not exists house_wallet (
  id int primary key default 1 check (id = 1),
  profit_balance numeric not null default 0,
  reserve_balance numeric not null default 0,
  updated_at timestamptz not null default now()
);

insert into house_wallet (id, profit_balance, reserve_balance)
values (1, 0, 0)
on conflict (id) do nothing;

create table if not exists house_ledger (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('profit', 'reserve')),
  amount numeric not null,
  reason text not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists house_ledger_created_idx on house_ledger(created_at desc);

alter table house_wallet enable row level security;
alter table house_ledger enable row level security;
