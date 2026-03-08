-- ============================================================
-- FIX: Tuition Events Not Loading in Finance Module
-- Run this in Supabase SQL Editor
-- ============================================================
-- Problem: The tuition_events table only had an admin-only policy,
-- which may silently return 0 rows instead of an error if is_admin()
-- returns false due to session/RLS timing issues.
-- Fix: Add an explicit SELECT policy for all authenticated users,
-- and keep admin-only policies for write operations.
-- ============================================================

-- Step 1: Drop all existing policies on tuition_events
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'tuition_events' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tuition_events', pol.policyname);
    END LOOP;
END $$;

-- Step 2: Make sure RLS is enabled
ALTER TABLE public.tuition_events ENABLE ROW LEVEL SECURITY;

-- Step 3: Allow ALL authenticated users to READ tuition events
-- (students, teachers, and admins all need to see event names/fees)
CREATE POLICY "tuition_events_select_all" ON public.tuition_events
  FOR SELECT TO authenticated
  USING (TRUE);

-- Step 4: Only admins can INSERT, UPDATE, DELETE events
CREATE POLICY "tuition_events_write_admin" ON public.tuition_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "tuition_events_update_admin" ON public.tuition_events
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "tuition_events_delete_admin" ON public.tuition_events
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Step 5: Ensure grants are in place
GRANT SELECT ON public.tuition_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tuition_events TO authenticated;
