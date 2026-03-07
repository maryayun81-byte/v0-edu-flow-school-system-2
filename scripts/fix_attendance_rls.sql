-- ============================================================
-- ATTENDANCE SYSTEM RLS FIX
-- Run this in your Supabase SQL Editor to resolve the "row-level security policy" error
-- ============================================================

-- 1. DROP PROBLEMATIC POLICIES
-- We drop and re-create policies using the project-standard is_admin() function to avoid recursion.

DROP POLICY IF EXISTS "Admins can manage events" ON public.tuition_events;
DROP POLICY IF EXISTS "Admins can manage event calendar" ON public.event_calendar;
DROP POLICY IF EXISTS "Admins can manage class teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.attendance_settings;
DROP POLICY IF EXISTS "Admins can manage eligibility" ON public.exam_eligibility;
DROP POLICY IF EXISTS "Admins see all logs" ON public.attendance_logs;

-- 2. CREATE NEW POLICIES USING is_admin()

-- Tuition Events
CREATE POLICY "Admins can manage events" ON public.tuition_events
  FOR ALL TO authenticated
  USING (public.is_admin());

-- Event Calendar
CREATE POLICY "Admins can manage event calendar" ON public.event_calendar
  FOR ALL TO authenticated
  USING (public.is_admin());

-- Class Teachers (The table causing the error)
CREATE POLICY "Admins can manage class teachers" ON public.class_teachers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Attendance Records
CREATE POLICY "Admins can manage all attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_admin());

-- Attendance Settings
CREATE POLICY "Admins can manage settings" ON public.attendance_settings
  FOR ALL TO authenticated
  USING (public.is_admin());

-- Exam Eligibility
CREATE POLICY "Admins can manage eligibility" ON public.exam_eligibility
  FOR ALL TO authenticated
  USING (public.is_admin());

-- Attendance Logs
CREATE POLICY "Admins see all logs" ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3. ENSURE SELECT POLICIES ARE ALSO ROBUST

DROP POLICY IF EXISTS "All can view class teachers" ON public.class_teachers;
CREATE POLICY "All authenticated can view class teachers" ON public.class_teachers
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Teachers and admins can view settings" ON public.attendance_settings;
CREATE POLICY "Teachers and admins can view settings" ON public.attendance_settings
  FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
  ));

-- VERIFICATION:
-- The is_admin() function is a SECURITY DEFINER function that bypasses RLS
-- and is already present in your database from previous fixes.
-- Using it here prevents the "recursion error" or "policy violation" 
-- when checking roles during write operations.
