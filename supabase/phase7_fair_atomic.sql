-- Phase 7 — atomic balance + fairness helpers
-- Run in Supabase SQL Editor after previous migrations

-- Optimistic locking for balance updates
alter table profiles add column if not exists balance_version int not null default 0;

-- Ensure finished rounds expose seed for public verify
-- (server_seed already exists; index for verify lookups)
create index if not exists rounds_roll_id_finished_idx
  on rounds(roll_id)
  where status = 'finished';

-- Optional: prevent reading server_seed via anon (already no write policies)
-- Public verify goes through service-role API only.
