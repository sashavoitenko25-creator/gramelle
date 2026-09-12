-- ============================================================
-- GRAMELLE atomic balance / payout RPC
--
-- Run once in Supabase SQL Editor AFTER the duplicate-win repair.
-- It is safe to re-run because CREATE OR REPLACE is used.
--
-- Main guarantee:
--   one winner + one round_id -> at most one "win" ledger entry
--   and one corresponding balance increment.
--
-- The profile row is locked with FOR UPDATE before the balance is
-- changed, so concurrent finalizers serialize on the same user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.gramelle_credit_balance(
  p_telegram_id bigint,
  p_amount numeric,
  p_reason text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_balance numeric;
  v_version bigint;
  v_wager numeric;
  v_new_balance numeric;
  v_round_id text;
  v_existing public.ledger%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Amount must be non-zero';
  END IF;

  /*
   * Lock the profile row.
   * This serializes concurrent balance mutations for the same Telegram user.
   */
  SELECT *
    INTO v_profile
  FROM public.profiles
  WHERE telegram_id = p_telegram_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  /*
   * WIN is idempotent by round_id.
   *
   * The unique index created by the repair migration is a second safety net,
   * but this check is what makes a concurrent second finalizer return cleanly
   * instead of ever modifying the balance a second time.
   */
  IF p_reason = 'win' THEN
    v_round_id := p_meta->>'round_id';

    IF v_round_id IS NOT NULL THEN
      SELECT *
        INTO v_existing
      FROM public.ledger
      WHERE telegram_id = p_telegram_id
        AND reason = 'win'
        AND meta->>'round_id' = v_round_id
      ORDER BY created_at ASC, id ASC
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'balance', COALESCE(v_profile.balance, 0),
          'profile_id', v_profile.id,
          'wager_remaining', COALESCE(v_profile.wager_remaining, 0),
          'idempotent', true
        );
      END IF;
    END IF;
  END IF;

  v_balance := COALESCE(v_profile.balance, 0);
  v_version := COALESCE(v_profile.balance_version, 0);
  v_wager := COALESCE(v_profile.wager_remaining, 0);

  v_new_balance := ROUND(v_balance + p_amount, 4);

  IF v_new_balance < -0.0001 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  /*
   * Existing wager semantics:
   * deposits increase the requirement, bets consume it.
   */
  IF p_reason IN ('deposit_stars', 'deposit_ton')
     AND p_amount > 0 THEN
    v_wager := ROUND(v_wager + p_amount, 4);
  ELSIF p_reason = 'bet'
     AND p_amount < 0 THEN
    v_wager := ROUND(
      GREATEST(0, v_wager - LEAST(v_wager, ABS(p_amount))),
      4
    );
  END IF;

  UPDATE public.profiles
  SET
    balance = v_new_balance,
    balance_version = v_version + 1,
    wager_remaining = v_wager
  WHERE id = v_profile.id;

  INSERT INTO public.ledger (
    profile_id,
    telegram_id,
    amount,
    balance_after,
    reason,
    meta
  )
  VALUES (
    v_profile.id,
    p_telegram_id,
    p_amount,
    v_new_balance,
    p_reason,
    COALESCE(p_meta, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'balance', v_new_balance,
    'profile_id', v_profile.id,
    'wager_remaining', v_wager,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gramelle_credit_balance(
  bigint,
  numeric,
  text,
  jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.gramelle_credit_balance(
  bigint,
  numeric,
  text,
  jsonb
) TO service_role;
