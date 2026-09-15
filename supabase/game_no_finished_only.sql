-- Number finished games only (no gaps from cancelled open rooms)
-- Run in Supabase SQL Editor once

-- XO
create or replace function public.xo_next_game_no()
returns bigint
language sql
as $$
  select nextval('xo_room_game_no_seq');
$$;

alter table xo_rooms alter column game_no drop not null;
alter table xo_rooms alter column game_no drop default;

-- clear numbers on non-finished so sequence is clean for future
update xo_rooms set game_no = null where status is distinct from 'finished';

-- renumber finished by finish time
with ranked as (
  select id, row_number() over (order by coalesce(finished_at, created_at), created_at) as seq
  from xo_rooms
  where status = 'finished'
)
update xo_rooms r
set game_no = ranked.seq
from ranked
where r.id = ranked.id;

select setval(
  'xo_room_game_no_seq',
  coalesce((select max(game_no) from xo_rooms where status = 'finished'), 1)
);

-- RPS
create or replace function public.rps_next_game_no()
returns bigint
language sql
as $$
  select nextval('rps_room_game_no_seq');
$$;

alter table rps_rooms alter column game_no drop not null;
alter table rps_rooms alter column game_no drop default;

update rps_rooms set game_no = null where status is distinct from 'finished';

with ranked as (
  select id, row_number() over (order by coalesce(finished_at, created_at), created_at) as seq
  from rps_rooms
  where status = 'finished'
)
update rps_rooms r
set game_no = ranked.seq
from ranked
where r.id = ranked.id;

select setval(
  'rps_room_game_no_seq',
  coalesce((select max(game_no) from rps_rooms where status = 'finished'), 1)
);

-- Dice
create or replace function public.dice_next_game_no()
returns bigint
language sql
as $$
  select nextval('dice_room_game_no_seq');
$$;

alter table dice_rooms alter column game_no drop not null;
alter table dice_rooms alter column game_no drop default;

update dice_rooms set game_no = null where status is distinct from 'finished';

with ranked as (
  select id, row_number() over (order by coalesce(finished_at, created_at), created_at) as seq
  from dice_rooms
  where status = 'finished'
)
update dice_rooms r
set game_no = ranked.seq
from ranked
where r.id = ranked.id;

select setval(
  'dice_room_game_no_seq',
  coalesce((select max(game_no) from dice_rooms where status = 'finished'), 1)
);

-- Sync history game_no from rooms
update xo_history h set game_no = r.game_no from xo_rooms r where h.room_id = r.id;
update rps_history h set game_no = r.game_no from rps_rooms r where h.room_id = r.id;
update dice_history h set game_no = r.game_no from dice_rooms r where h.room_id = r.id;
