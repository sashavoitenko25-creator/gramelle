-- Gramelle production hardening (run once)
-- Safe to re-run

alter table public.profiles add column if not exists banned boolean default false;
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists photo_url text;
alter table public.profiles add column if not exists biggest_win numeric default 0;
alter table public.profiles add column if not exists wins int default 0;
alter table public.profiles add column if not exists games int default 0;
alter table public.profiles add column if not exists ton_wallet text;
alter table public.profiles add column if not exists ref_turnover numeric default 0;
alter table public.profiles add column if not exists ref_active int default 0;
alter table public.profiles add column if not exists balance_version int default 0;
alter table public.profiles add column if not exists wager_remaining numeric default 0;

create index if not exists profiles_banned_idx on public.profiles (banned) where banned = true;
create index if not exists ledger_tg_created_idx on public.ledger (telegram_id, created_at desc);
create index if not exists withdrawals_status_idx on public.withdrawals (status, created_at desc);
create index if not exists ton_deposits_status_idx on public.ton_deposits (status, created_at desc);
create index if not exists rps_rooms_status_created_idx on public.rps_rooms (status, created_at desc);
create index if not exists rps_history_room_idx on public.rps_history (room_id);

-- Drop spin leftovers if any
drop table if exists public.round_bets cascade;
drop table if exists public.rounds cascade;
drop table if exists public.game_history cascade;
