-- ============================================================
-- FIX: Tuition Events Visibility & Missing Column
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add tuition_fee column to tuition_events table if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='tuition_fee') THEN
    ALTER TABLE public.tuition_events ADD COLUMN tuition_fee NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- 2. Ensure RLS allows selecting this new column (should be covered by generic SELECT policy)
-- But let's re-verify grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tuition_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tuition_events TO service_role;

-- 3. Optionally, update existing events with a default fee if needed
UPDATE public.tuition_events SET tuition_fee = 0 WHERE tuition_fee IS NULL;
