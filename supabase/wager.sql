-- Wager x1: must play deposited amount before withdraw
alter table profiles
  add column if not exists wager_remaining numeric not null default 0;

comment on column profiles.wager_remaining is 'GRAM left to wager before withdraw is allowed (x1 deposit)';
