-- Gramelle: permanent global game numbers for RPS and Dice history.
-- Run this ONCE in Supabase SQL Editor before/after deploying the code fix.
-- Existing rows are numbered chronologically (oldest game = #1).
-- New rooms receive the next number atomically from a PostgreSQL sequence.

-- =========================================================
-- RPS room numbers
-- =========================================================
create sequence if not exists rps_room_game_no_seq;

alter table rps_rooms
  add column if not exists game_no bigint;

alter table rps_rooms
  alter column game_no set default nextval('rps_room_game_no_seq');

alter sequence rps_room_game_no_seq
  owned by rps_rooms.game_no;

with ranked as (
  select id,
         row_number() over (order by created_at asc, id asc) as seq
  from rps_rooms
  where game_no is null
)
update rps_rooms r
set game_no = ranked.seq
from ranked
where r.id = ranked.id;

select setval(
  'rps_room_game_no_seq',
  coalesce((select max(game_no) from rps_rooms), 1),
  (select count(*) > 0 from rps_rooms)
);

alter table rps_rooms
  alter column game_no set not null;

create unique index if not exists rps_rooms_game_no_uidx
  on rps_rooms(game_no);

-- =========================================================
-- Dice room numbers
-- =========================================================
create sequence if not exists dice_room_game_no_seq;

alter table dice_rooms
  add column if not exists game_no bigint;

alter table dice_rooms
  alter column game_no set default nextval('dice_room_game_no_seq');

alter sequence dice_room_game_no_seq
  owned by dice_rooms.game_no;

with ranked as (
  select id,
         row_number() over (order by created_at asc, id asc) as seq
  from dice_rooms
  where game_no is null
)
update dice_rooms r
set game_no = ranked.seq
from ranked
where r.id = ranked.id;

select setval(
  'dice_room_game_no_seq',
  coalesce((select max(game_no) from dice_rooms), 1),
  (select count(*) > 0 from dice_rooms)
);

alter table dice_rooms
  alter column game_no set not null;

create unique index if not exists dice_rooms_game_no_uidx
  on dice_rooms(game_no);

-- =========================================================
-- RPS history: copy permanent room number into each player row
-- =========================================================
alter table rps_history
  add column if not exists game_no bigint;

update rps_history h
set game_no = r.game_no
from rps_rooms r
where h.room_id = r.id
  and h.game_no is null;

create index if not exists rps_history_game_no_idx
  on rps_history(game_no);

-- =========================================================
-- Dice history: copy permanent room number into each player row
-- =========================================================
alter table dice_history
  add column if not exists game_no bigint;

update dice_history h
set game_no = r.game_no
from dice_rooms r
where h.room_id = r.id
  and h.game_no is null;

create index if not exists dice_history_game_no_idx
  on dice_history(game_no);

-- =========================================================
-- Verification
-- =========================================================
select 'RPS rooms' as source, count(*) as rows, min(game_no) as min_no, max(game_no) as max_no
from rps_rooms
union all
select 'Dice rooms', count(*), min(game_no), max(game_no)
from dice_rooms;
