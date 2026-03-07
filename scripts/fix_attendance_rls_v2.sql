-- ============================================================
-- ATTENDANCE RLS FIX - VERSION 2
-- Run this in Supabase SQL Editor to fix "new row violates RLS"
-- ============================================================

-- 1. Ensure Robust is_admin() Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. COMPLETELY RESET Class Teachers Table RLS
ALTER TABLE public.class_teachers DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage class teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "All can view class teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "All authenticated can view class teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "Admins can manage everything" ON public.class_teachers;

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- 3. APPLY CLEAN POLICIES for Class Teachers
-- Policy: All authenticated users can VIEW class teachers (needed to see current designations)
CREATE POLICY "class_teachers_select_policy" ON public.class_teachers
  FOR SELECT TO authenticated USING (TRUE);

-- Policy: Admins can do EVERYTHING else
CREATE POLICY "class_teachers_admin_policy" ON public.class_teachers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. ENSURE Profiles allows is_admin() to work correctly
-- Since is_admin is SECURITY DEFINER, it should be fine, but let's make sure
-- profiles has a permissive select policy for admins.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.is_admin() OR auth.uid() = id
);

-- 5. FIX Other Attendance Tables Just In Case
-- Tuition Events
ALTER TABLE public.tuition_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage events" ON public.tuition_events;
CREATE POLICY "Admins can manage events" ON public.tuition_events
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Attendance Records
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;
CREATE POLICY "Admins can manage all attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Exam Eligibility
ALTER TABLE public.exam_eligibility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage eligibility" ON public.exam_eligibility;
CREATE POLICY "Admins can manage eligibility" ON public.exam_eligibility
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Attendance Settings
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.attendance_settings;
CREATE POLICY "Admins can manage settings" ON public.attendance_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
