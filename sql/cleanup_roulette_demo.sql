-- Gramelle: clear LIVE Roulette DEMO history only
-- Does NOT touch: RPS, Dice, XO, Race, profiles, ledger balances, withdrawals, tasks
-- Run once in Supabase → SQL Editor

-- 1) All bets (history of stakes)
delete from public.roulette_bets;

-- 2) All rounds (settled + any stuck betting/spinning from tests)
delete from public.roulette_rounds;

-- Verify
select
  (select count(*) from public.roulette_bets) as bets_left,
  (select count(*) from public.roulette_rounds) as rounds_left;
-- expected: 0 / 0

-- Next open of Live will auto-create a fresh betting round via advanceRoulette().
