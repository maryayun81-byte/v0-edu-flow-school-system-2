-- ============================================================
-- COMPREHENSIVE RLS RESET & FIX
-- Run this in Supabase SQL Editor to resolve hangs and permission issues
-- ============================================================

-- 1. Ensure Robust is_admin() Function (SECURITY DEFINER)
-- Marked as SECURITY DEFINER to bypass RLS when checking roles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role TEXT;
BEGIN
  SELECT role INTO current_role FROM public.profiles WHERE id = auth.uid();
  RETURN (current_role = 'admin');
END;
$$;

-- 2. CLEAR and RESET Profiles Policies
-- We drop all existing policies to ensure no conflicts or recursion hidden in old policies.
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone authenticated can see ALL profiles (simplest, prevents recursion, allows teachers to see students)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (TRUE);

-- Policy: Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Policy: Admins can update any profile (uses is_admin() which bypasses RLS)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin());

-- 3. RESET Class Teachers Policies
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "class_teachers_select_policy" ON public.class_teachers;
DROP POLICY IF EXISTS "class_teachers_admin_policy" ON public.class_teachers;
DROP POLICY IF EXISTS "Admins can manage class teachers" ON public.class_teachers;
DROP POLICY IF EXISTS "All can view class teachers" ON public.class_teachers;

CREATE POLICY "class_teachers_select_policy" ON public.class_teachers
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "class_teachers_admin_policy" ON public.class_teachers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. ENSURE Attendance Tables are usable
-- Attendance SELECT
DROP POLICY IF EXISTS "Students see own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;
CREATE POLICY "attendance_select_policy" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );

-- Attendance INSERT (for teachers)
DROP POLICY IF EXISTS "Class teachers can insert attendance" ON public.attendance;
CREATE POLICY "attendance_insert_teacher_policy" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    marked_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.class_teachers ct
      WHERE ct.teacher_id = auth.uid() AND ct.class_id = attendance.class_id
    )
  );

-- Attendance ADMIN
CREATE POLICY "attendance_admin_all" ON public.attendance
  FOR ALL TO authenticated USING (public.is_admin());

-- 5. FINAL: Grant permissions to roles just in case
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.class_teachers TO authenticated;
GRANT ALL ON public.attendance TO authenticated;
GRANT ALL ON public.tuition_events TO authenticated;
GRANT ALL ON public.event_calendar TO authenticated;
