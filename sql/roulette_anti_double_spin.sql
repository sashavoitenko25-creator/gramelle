-- ============================================================
-- LIVE Roulette: kill double-spin / double-paravoz permanently
-- + purge phantom history rows
-- Run once in Supabase SQL Editor
-- ============================================================

-- 1) At most ONE live round (betting OR spinning) in the whole table.
CREATE UNIQUE INDEX IF NOT EXISTS roulette_rounds_one_live
  ON public.roulette_rounds ((1))
  WHERE status IN ('betting', 'spinning');

-- 2) Paravoz: last_round_id prevents +2 / double-apply for same round
ALTER TABLE public.roulette_paravoz
  ADD COLUMN IF NOT EXISTS last_round_id uuid;

CREATE INDEX IF NOT EXISTS roulette_paravoz_last_round_idx
  ON public.roulette_paravoz (last_round_id);

-- 3) Keep oldest live row; DELETE other live orphans (never invent results)
DO $$
DECLARE
  keep_id uuid;
BEGIN
  SELECT id INTO keep_id
  FROM public.roulette_rounds
  WHERE status IN ('betting', 'spinning')
  ORDER BY created_at ASC
  LIMIT 1;

  IF keep_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.roulette_rounds
  WHERE status IN ('betting', 'spinning')
    AND id <> keep_id
    AND spin_ends_at IS NULL;
END $$;

-- 4) PURGE phantom settled rounds that never actually spun
--    (these polluted "ИСТОРИЯ" with fake colors)
DELETE FROM public.roulette_rounds
WHERE status = 'settled'
  AND spin_ends_at IS NULL;
