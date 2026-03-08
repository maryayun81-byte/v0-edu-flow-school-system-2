-- Fix Visibility Schema and RLS Policies (Revised & Robust)
-- This script addresses the "check constraint" error and the "profiles RLS violation" error.

-- 1. Fix Notifications Table Brittle Constraint
-- The previous list was missing: 'exam_status', 'marks_submitted', 'transcript_published'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
-- We'll add a more inclusive list or just leave it for now to allow all types from current modules.
-- Given the variety of modules, let's include everything found in DB.
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('info', 'warning', 'success', 'urgent', 'note', 'assignment', 'timetable', 'quiz', 'class', 'general', 'activity', 'exam_status', 'marks_submitted', 'transcript_published'));

-- Ensure target_class_id exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='target_class_id') THEN
        ALTER TABLE notifications ADD COLUMN target_class_id UUID REFERENCES classes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Create Profile Trigger (The Supabase Way)
-- This automatically creates a profile when a new user signs up.
-- It bypasses RLS because it runs with SECURITY DEFINER (owner privileges).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    email, 
    role, 
    profile_completed, 
    created_at, 
    updated_at
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email), 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'role', 'student'), 
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on every signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync existing users to profiles (Safety)
INSERT INTO public.profiles (id, full_name, email, role, created_at, updated_at)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', email, 'User'), 
    email,
    COALESCE(raw_user_meta_data->>'role', 'student'), 
    NOW(), 
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 4. Fix Assignments RLS (Tightened for Data Isolation)
DROP POLICY IF EXISTS "Students see assignments for their class" ON assignments;
CREATE POLICY "Students see assignments for their class" 
ON assignments FOR SELECT 
USING (
    (teacher_id = auth.uid()) -- Creator (Teacher) can always see
    OR 
    EXISTS (
        SELECT 1 FROM student_classes sc
        WHERE sc.student_id = auth.uid() 
        AND sc.class_id = assignments.class_id
    ) -- Enrolled students
    OR 
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    ) -- Admins
);

-- 5. Fix Notes RLS (Tightened for Data Isolation)
DROP POLICY IF EXISTS "Authenticated users can view notes" ON notes;
DROP POLICY IF EXISTS "Students can view notes for their class" ON notes;
CREATE POLICY "Students can view notes for their class"
ON notes FOR SELECT
TO authenticated
USING (
    (created_by = auth.uid()) -- Creator (Teacher)
    OR
    EXISTS (
        SELECT 1 FROM student_classes sc
        WHERE sc.student_id = auth.uid() 
        AND sc.class_id = notes.class_id
    ) -- Enrolled students
    OR
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    ) -- Admins
);

-- 6. Fix Notifications RLS (Permissive for authenticated)
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" 
ON notifications FOR SELECT 
USING (
    audience = 'all'
    OR (audience = 'student' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student'))
    OR (audience = 'teacher' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'))
    OR (audience = 'individual' AND (target_user_id = auth.uid() OR recipient_id = auth.uid()))
    OR (target_class_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM student_classes sc 
        WHERE sc.student_id = auth.uid() AND sc.class_id = notifications.target_class_id
    ))
    OR broadcast = TRUE
);

-- 1.5. Helper Functions (Avoid RLS Recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Profile Trigger (The Supabase Way)
-- ... (rest of Step 2 and 3) ...
-- ... (I'll just replace the whole profiles section Step 7) ...

-- 7. Fix Profiles RLS (Safe & Robust)
-- We allow public read and personal updates.
-- Admins can manage all.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles 
FOR UPDATE USING (auth.uid() = id);

-- Allow admins to manage all - Using SECURITY DEFINER function to avoid recursion
DROP POLICY IF EXISTS "Admins manage all profiles" ON profiles;
CREATE POLICY "Admins manage all profiles" ON profiles 
FOR ALL USING (public.is_admin());

-- Ensure onboarding_completed column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 8. Fix Teacher Subject Preferences
CREATE TABLE IF NOT EXISTS teacher_subject_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  preferred_classes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject)
);

ALTER TABLE teacher_subject_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage own preferences" ON teacher_subject_preferences;
CREATE POLICY "Teachers can manage own preferences" ON teacher_subject_preferences
  FOR ALL USING (teacher_id = auth.uid());

-- Allow admins to view
DROP POLICY IF EXISTS "Admins can view all preferences" ON teacher_subject_preferences;
CREATE POLICY "Admins can view all preferences" ON teacher_subject_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );
