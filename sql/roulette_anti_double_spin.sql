-- ============================================================
-- LIVE Roulette: kill double-spin / double-paravoz permanently
-- Run once in Supabase SQL Editor
-- ============================================================

-- 1) At most ONE live round (betting OR spinning) in the whole table.
--    Concurrent createBettingRound inserts will fail unique → code re-fetches.
CREATE UNIQUE INDEX IF NOT EXISTS roulette_rounds_one_live
  ON public.roulette_rounds ((1))
  WHERE status IN ('betting', 'spinning');

-- 2) Paravoz: last_round_id prevents +2 / double-apply for same round
ALTER TABLE public.roulette_paravoz
  ADD COLUMN IF NOT EXISTS last_round_id uuid;

CREATE INDEX IF NOT EXISTS roulette_paravoz_last_round_idx
  ON public.roulette_paravoz (last_round_id);

-- 3) If orphans already exist (two+ live rows), keep the oldest, settle the rest
DO $$
DECLARE
  keep_id uuid;
  r record;
BEGIN
  SELECT id INTO keep_id
  FROM public.roulette_rounds
  WHERE status IN ('betting', 'spinning')
  ORDER BY created_at ASC
  LIMIT 1;

  IF keep_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT id FROM public.roulette_rounds
    WHERE status IN ('betting', 'spinning')
      AND id <> keep_id
  LOOP
    UPDATE public.roulette_rounds
    SET
      status = 'settled',
      result_ends_at = COALESCE(result_ends_at, now()),
      result_slot = COALESCE(result_slot, 0),
      result_color = COALESCE(result_color, 'green')
    WHERE id = r.id;
  END LOOP;
END $$;
