-- =====================================================
-- COMPREHENSIVE FIX: All Critical Issues (CORRECTED)
-- =====================================================
-- Run this script in Supabase SQL Editor to fix:
-- 1. Teachers showing 0 in admin dashboard
-- 2. Missing teacher profiles
-- 3. Messaging system setup
-- =====================================================

-- =====================================================
-- PART 1: Fix Teacher Profiles
-- =====================================================

-- Step 1: Check current state (Selects will display in results)
SELECT 
  'Auth Users' as type,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Profiles' as type,
  COUNT(*) as count
FROM profiles
UNION ALL
SELECT 
  'Teachers' as type,
  COUNT(*) as count
FROM profiles WHERE role = 'teacher';

-- Step 2: Create profiles for ALL auth users who don't have one
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name', 
    split_part(u.email, '@', 1)
  ) as full_name,
  COALESCE(
    u.raw_user_meta_data->>'role',
    CASE 
      WHEN u.email LIKE '%teacher%' THEN 'teacher'
      WHEN u.email LIKE '%admin%' THEN 'admin'
      ELSE 'student'
    END
  ) as role,
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Fix existing profiles that should be teachers
UPDATE profiles p
SET 
  role = 'teacher',
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND (u.email LIKE '%teacher%' OR u.raw_user_meta_data->>'role' = 'teacher')
  AND p.role != 'teacher';

-- Step 4: Ensure all teacher profiles have proper structure
UPDATE profiles
SET 
  admission_number = COALESCE(admission_number, 'TCH-' || SUBSTRING(id::text, 1, 8)),
  school_name = COALESCE(school_name, 'EduFlow School'),
  updated_at = NOW()
WHERE role = 'teacher'
  AND (admission_number IS NULL OR school_name IS NULL);

-- Step 5: Verify the fix (Using DO block for Notice)
DO $$
DECLARE
  teacher_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO teacher_count FROM profiles WHERE role = 'teacher';
  RAISE NOTICE '=== TEACHER FIX COMPLETE ===';
  RAISE NOTICE 'Total teachers in profiles table: %', teacher_count;
END $$;

-- Display all teachers
SELECT 
  id,
  full_name,
  email,
  subject,
  created_at
FROM profiles
WHERE role = 'teacher'
ORDER BY created_at DESC;

-- =====================================================
-- PART 2: Verify Messaging Functions Exist
-- =====================================================

-- Check if messaging functions are created
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%messageable%'
ORDER BY routine_name;

-- If no results above, you need to run: messaging-participant-resolution.sql

-- =====================================================
-- PART 3: Create Missing Indexes for Performance
-- =====================================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role_created ON profiles(role, created_at DESC);

-- =====================================================
-- PART 4: Verify RLS Policies
-- =====================================================

-- Check existing policies on profiles table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Final verification
SELECT 
  'Total Users' as metric,
  COUNT(*)::text as value
FROM auth.users
UNION ALL
SELECT 
  'Total Profiles' as metric,
  COUNT(*)::text as value
FROM profiles
UNION ALL
SELECT 
  'Teachers' as metric,
  COUNT(*)::text as value
FROM profiles WHERE role = 'teacher'
UNION ALL
SELECT 
  'Students' as metric,
  COUNT(*)::text as value
FROM profiles WHERE role = 'student'
UNION ALL
SELECT 
  'Admins' as metric,
  COUNT(*)::text as value
FROM profiles WHERE role = 'admin'
UNION ALL
SELECT 
  'Orphaned Auth Users' as metric,
  COUNT(*)::text as value
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- =====================================================
-- DIAGNOSTICS
-- =====================================================

-- If teachers still show 0, run this to see what's wrong:
SELECT 
  u.id,
  u.email,
  u.created_at as auth_created,
  u.raw_user_meta_data,
  p.id as profile_id,
  p.role,
  p.full_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%teacher%'
ORDER BY u.created_at DESC;

DO $$
BEGIN
  RAISE NOTICE '=== SCRIPT COMPLETE ===';
  RAISE NOTICE 'If teachers still show 0:';
  RAISE NOTICE '1. Check admin dashboard query is: SELECT * FROM profiles WHERE role = ''teacher''';
  RAISE NOTICE '2. Refresh the admin dashboard page';
  RAISE NOTICE '3. Check browser console for errors';
END $$;
