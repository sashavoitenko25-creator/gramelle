-- Phase 2 migration — run in Supabase SQL Editor

-- Room mode on rounds
alter table rounds add column if not exists mode text not null default 'classic';
alter table rounds add column if not exists house_fee numeric;
alter table rounds add column if not exists pot_after_fee numeric;
alter table rounds add column if not exists version int not null default 0;

create index if not exists rounds_mode_status_idx on rounds(mode, status);

-- Optional: constrain mode values
-- alter table rounds drop constraint if exists rounds_mode_check;
-- alter table rounds add constraint rounds_mode_check check (mode in ('classic', 'high'));
