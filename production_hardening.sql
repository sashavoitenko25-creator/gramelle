-- Gramelle production hardening migration
-- Run manually in the Supabase SQL editor AFTER reviewing the database state.
-- This migration is intentionally separate from the app replacement files.

-- New accounts must start at zero. This changes the DEFAULT only;
-- it does not alter existing balances.
alter table if exists profiles
  alter column balance set default 0;

-- Fields used by the current server round engine.
alter table if exists rounds add column if not exists version bigint not null default 0;
alter table if exists rounds add column if not exists mode text default 'classic';
alter table if exists rounds add column if not exists room_seq bigint;
alter table if exists rounds add column if not exists house_fee numeric not null default 0;
alter table if exists rounds add column if not exists pot_after_fee numeric;

-- Prevent duplicate server payout/history entries for one player in one roll.
-- This does NOT delete data automatically. If this fails, inspect duplicates first.
create unique index if not exists game_history_roll_player_uidx
  on game_history (roll_id, telegram_id)
  where roll_id is not null and telegram_id is not null;

-- One winning ledger entry per player per round.
create unique index if not exists ledger_win_round_uidx
  on ledger (telegram_id, ((meta->>'round_id')))
  where reason = 'win' and meta->>'round_id' is not null;

-- One house-fee ledger entry per round.
create unique index if not exists house_ledger_fee_round_uidx
  on house_ledger (reason, ((meta->>'round_id')))
  where reason = 'house_fee' and meta->>'round_id' is not null;

-- Helpful indexes for room polling/recovery.
create index if not exists rounds_mode_status_roll_idx
  on rounds (mode, status, roll_id desc);

create index if not exists round_bets_round_player_idx
  on round_bets (round_id, telegram_id);

-- IMPORTANT: inspect active duplicates before adding a partial unique index:
-- select mode, count(*) from rounds
-- where status in ('open','countdown','spinning')
-- group by mode having count(*) > 1;
-- After duplicates are resolved, you can enforce the invariant with:
-- create unique index rounds_one_active_per_mode_uidx
--   on rounds(mode)
--   where status in ('open','countdown','spinning');
