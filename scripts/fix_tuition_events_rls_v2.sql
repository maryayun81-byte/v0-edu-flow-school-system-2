-- ============================================================
-- FINAL FIX: Tuition Events RLS Policy (Insert Permission)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Define a robust is_admin() function if it doesn't exist or update it
-- This uses the user's JWT metadata which is the most reliable way in Supabase
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    get_my_claim('role') = 'admin'
    OR 
    (auth.jwt() ->> 'role') = 'admin'
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Ensure the get_my_claim function exists (helper for metadata)
CREATE OR REPLACE FUNCTION public.get_my_claim(claim text)
RETURNS text AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> claim);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Re-apply policies to tuition_events
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'tuition_events' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tuition_events', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.tuition_events ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for all authenticated users
CREATE POLICY "tuition_events_select_all" ON public.tuition_events
  FOR SELECT TO authenticated
  USING (TRUE);

-- Allow INSERT for admins
-- We use a simple check first, then fallback to profiles if needed
CREATE POLICY "tuition_events_insert_admin" ON public.tuition_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role' = 'service_role') -- allow service role
    OR (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') -- check metadata
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') -- check profiles table
  );

-- Allow UPDATE for admins
CREATE POLICY "tuition_events_update_admin" ON public.tuition_events
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow DELETE for admins
CREATE POLICY "tuition_events_delete_admin" ON public.tuition_events
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Step 4: Ensure grants are correct
GRANT ALL ON public.tuition_events TO authenticated;
GRANT ALL ON public.tuition_events TO service_role;
