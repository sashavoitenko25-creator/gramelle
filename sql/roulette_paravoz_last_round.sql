-- Prevent double-count of Paravoz cells for the same round
alter table public.roulette_paravoz
  add column if not exists last_round_id uuid;

create index if not exists roulette_paravoz_last_round_idx
  on public.roulette_paravoz (last_round_id);
