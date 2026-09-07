-- Run in Supabase SQL editor (existing DBs)
alter table rounds add column if not exists room_seq bigint;

-- Backfill per mode by created_at order
with ranked as (
  select id, mode,
    row_number() over (partition by mode order by created_at asc, roll_id asc) as seq
  from rounds
  where room_seq is null
)
update rounds r
set room_seq = ranked.seq
from ranked
where r.id = ranked.id;

create unique index if not exists rounds_mode_room_seq_uidx on rounds (mode, room_seq);

-- Re-number any null room_seq so history doesn't stuck at #1
with ranked as (
  select id, mode,
    row_number() over (partition by mode order by created_at asc, roll_id asc) as seq
  from rounds
)
update rounds r
set room_seq = ranked.seq
from ranked
where r.id = ranked.id and (r.room_seq is null or r.room_seq is distinct from ranked.seq);
