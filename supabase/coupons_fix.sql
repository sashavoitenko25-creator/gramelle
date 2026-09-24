-- Apply this once to the existing production Supabase database after deploying
-- the coupon code. Safe to run more than once.

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

revoke execute on function redeem_promo(bigint,text) from public, anon, authenticated;
revoke execute on function consume_coupon(bigint,uuid,text) from public, anon, authenticated;
revoke execute on function refund_coupon(bigint,uuid) from public, anon, authenticated;
revoke execute on function promo_code_analytics() from public, anon, authenticated;
grant execute on function redeem_promo(bigint,text) to service_role;
grant execute on function consume_coupon(bigint,uuid,text) to service_role;
grant execute on function refund_coupon(bigint,uuid) to service_role;
grant execute on function promo_code_analytics() to service_role;
