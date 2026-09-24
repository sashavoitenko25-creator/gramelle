
-- Gramelle Coupons / Promo Codes
alter table profiles add column if not exists balance_version int not null default 0;
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  reward_type text not null check (reward_type in ('balance','coupon')),
  amount numeric not null check (amount > 0),
  max_uses integer not null check (max_uses > 0),
  uses integer not null default 0,
  game text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists promo_codes_code_idx on promo_codes(lower(code));

create table if not exists promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references promo_codes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  telegram_id bigint not null,
  created_at timestamptz not null default now(),
  unique(promo_id, profile_id)
);
create index if not exists promo_redemptions_profile_idx on promo_redemptions(profile_id);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  telegram_id bigint not null,
  promo_id uuid references promo_codes(id) on delete set null,
  amount numeric not null check (amount > 0),
  game text,
  status text not null default 'active' check (status in ('active','used','refunded','expired')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz,
  used_game text,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists coupons_profile_status_idx on coupons(profile_id,status);
create index if not exists coupons_telegram_status_idx on coupons(telegram_id,status);

alter table promo_codes enable row level security;
alter table promo_redemptions enable row level security;
alter table coupons enable row level security;

-- Atomic promo redemption. All public writes remain server-side via service role.
create or replace function redeem_promo(p_telegram_id bigint, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_promo promo_codes%rowtype;
  v_coupon coupons%rowtype;
begin
  select * into v_profile from profiles where telegram_id = p_telegram_id for update;
  if not found then raise exception 'Profile not found'; end if;

  select * into v_promo from promo_codes
    where lower(code) = lower(trim(p_code))
    and active = true
    and (expires_at is null or expires_at > now())
    for update;
  if not found then raise exception 'Promo code is invalid or expired'; end if;

  if v_promo.uses >= v_promo.max_uses then
    raise exception 'Promo code has reached its limit';
  end if;

  if exists (select 1 from promo_redemptions where promo_id=v_promo.id and profile_id=v_profile.id) then
    raise exception 'Promo code already used';
  end if;

  insert into promo_redemptions(promo_id,profile_id,telegram_id)
  values(v_promo.id,v_profile.id,p_telegram_id);
  update promo_codes set uses=uses+1 where id=v_promo.id;

  if v_promo.reward_type = 'balance' then
    update profiles set balance=balance+v_promo.amount, balance_version=coalesce(balance_version,0)+1 where id=v_profile.id;
    insert into ledger(profile_id,telegram_id,amount,balance_after,reason,meta)
    values(v_profile.id,p_telegram_id,v_promo.amount,v_profile.balance+v_promo.amount,'promo',jsonb_build_object('promo_code',v_promo.code));
  else
    insert into coupons(profile_id,telegram_id,promo_id,amount,game,expires_at,meta)
    values(v_profile.id,p_telegram_id,v_promo.id,v_promo.amount,v_promo.game,v_promo.expires_at,jsonb_build_object('promo_code',v_promo.code))
    returning * into v_coupon;
  end if;

  return jsonb_build_object(
    'reward_type',v_promo.reward_type,
    'amount',v_promo.amount,
    'game',v_promo.game,
    'code',v_promo.code,
    'balance', (select balance from profiles where id=v_profile.id),
    'coupon_id', case when v_promo.reward_type='coupon' then v_coupon.id else null end
  );
end $$;

-- Atomically consume a coupon for a game.
create or replace function consume_coupon(
  p_telegram_id bigint,
  p_coupon_id uuid,
  p_game text
) returns table(coupon_id uuid, amount numeric, game text)
language plpgsql
security definer
set search_path = public
as $$
declare v coupons%rowtype;
begin
  select * into v from coupons
  where id=p_coupon_id and telegram_id=p_telegram_id and status='active'
    and (expires_at is null or expires_at > now())
  for update;
  if not found then raise exception 'Coupon is unavailable'; end if;
  if v.game is not null and v.game <> 'all' and v.game <> p_game then
    raise exception 'Coupon is for another game';
  end if;
  update coupons set status='used',used_at=now(),used_game=p_game where id=v.id;
  return query select v.id,v.amount,v.game;
end $$;

create or replace function refund_coupon(p_telegram_id bigint,p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update coupons set status='active',used_at=null,used_game=null
  where id=p_coupon_id and telegram_id=p_telegram_id and status='used';
  return found;
end $$;


alter table rps_rooms add column if not exists coupon_id uuid references coupons(id) on delete set null;
alter table dice_rooms add column if not exists coupon_id uuid references coupons(id) on delete set null;
alter table xo_rooms add column if not exists coupon_id uuid references coupons(id) on delete set null;
alter table roulette_bets add column if not exists coupon_id uuid references coupons(id) on delete set null;
alter table pvp_roulette_bets add column if not exists coupon_id uuid references coupons(id) on delete set null;


-- Case-insensitive promo-code uniqueness. The application normalizes codes to
-- uppercase, but the database must enforce the invariant too (including direct SQL).
create or replace function prevent_duplicate_promo_code_ci()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  if exists (
    select 1 from promo_codes p
    where lower(p.code) = lower(new.code)
      and p.id <> coalesce(new.id, gen_random_uuid())
  ) then
    raise exception 'Promo code already exists';
  end if;
  return new;
end $$;

drop trigger if exists promo_codes_ci_unique on promo_codes;
create trigger promo_codes_ci_unique
before insert or update of code on promo_codes
for each row execute function prevent_duplicate_promo_code_ci();


-- Server-side aggregation for admin analytics. Avoids arbitrary API row limits.
create or replace function promo_code_analytics()
returns table(
  promo_id uuid,
  redemptions bigint,
  coupons_issued bigint,
  coupons_active bigint,
  coupons_used bigint,
  coupon_value numeric,
  balance_granted numeric
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    (select count(*) from promo_redemptions r where r.promo_id = p.id)::bigint,
    (select count(*) from coupons c where c.promo_id = p.id)::bigint,
    (select count(*) from coupons c where c.promo_id = p.id and c.status = 'active')::bigint,
    (select count(*) from coupons c where c.promo_id = p.id and c.status = 'used')::bigint,
    coalesce((select sum(c.amount) from coupons c where c.promo_id = p.id), 0)::numeric,
    case when p.reward_type = 'balance'
      then (select count(*) from promo_redemptions r where r.promo_id = p.id)::numeric * p.amount
      else 0::numeric
    end
  from promo_codes p;
$$;

-- These SECURITY DEFINER functions are server-only. Do not expose them through PostgREST.
revoke execute on function redeem_promo(bigint,text) from public, anon, authenticated;
revoke execute on function consume_coupon(bigint,uuid,text) from public, anon, authenticated;
revoke execute on function refund_coupon(bigint,uuid) from public, anon, authenticated;
revoke execute on function promo_code_analytics() from public, anon, authenticated;
grant execute on function redeem_promo(bigint,text) to service_role;
grant execute on function consume_coupon(bigint,uuid,text) to service_role;
grant execute on function refund_coupon(bigint,uuid) to service_role;
grant execute on function promo_code_analytics() to service_role;

