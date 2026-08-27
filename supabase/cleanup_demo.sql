-- Optional fresh start for rounds & history (keeps balances, profiles, ledger)
-- Run in Supabase SQL Editor

truncate table round_bets restart identity cascade;
truncate table game_history restart identity cascade;
truncate table rounds restart identity cascade;

-- Next roll_id will be 1000 (app uses last+1 or 999+1)
