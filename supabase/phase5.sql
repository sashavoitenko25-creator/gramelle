-- Phase 5 — infra: bans, analytics, admin notes
-- Run after phase3.sql

alter table profiles add column if not exists banned boolean not null default false;
alter table profiles add column if not exists ban_reason text;
alter table profiles add column if not exists banned_at timestamptz;

create index if not exists profiles_banned_idx on profiles(banned) where banned = true;

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  props jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_idx on analytics_events(name);
create index if not exists analytics_events_created_idx on analytics_events(created_at desc);

alter table analytics_events enable row level security;
-- no anon policies — service role only

-- Useful view for admin: recent ledger volume
create or replace view admin_daily_stats as
select
  date_trunc('day', created_at) as day,
  reason,
  count(*) as ops,
  sum(amount) as volume
from ledger
group by 1, 2
order by 1 desc;
