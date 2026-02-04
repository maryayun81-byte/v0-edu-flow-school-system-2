-- =====================================================
-- Fix Teacher Profiles Showing 0 in Admin Dashboard
-- =====================================================
-- This script fixes the issue where teachers don't appear
-- in the admin dashboard by ensuring all teacher auth users
-- have proper profiles with role = 'teacher'
-- =====================================================

-- Step 1: Check current state
SELECT 
  u.id,
  u.email,
  u.created_at as auth_created,
  p.role,
  p.full_name,
  p.subject
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%teacher%' OR p.role = 'teacher'
ORDER BY u.created_at DESC;

-- Step 2: Create profiles for teachers who don't have one
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) as full_name,
  'teacher' as role,
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND (u.email LIKE '%teacher%' OR u.raw_user_meta_data->>'role' = 'teacher')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Update existing profiles to ensure role is 'teacher'
UPDATE profiles
SET role = 'teacher', updated_at = NOW()
WHERE email LIKE '%teacher%' AND role != 'teacher';

-- Step 4: Verify the fix
SELECT 
  COUNT(*) as total_teachers,
  COUNT(CASE WHEN subject IS NOT NULL THEN 1 END) as teachers_with_subject,
  COUNT(CASE WHEN subject IS NULL THEN 1 END) as teachers_without_subject
FROM profiles
WHERE role = 'teacher';

-- Step 5: List all teachers
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
-- OPTIONAL: Manually add specific teachers
-- =====================================================
-- If you know specific teacher emails, you can manually ensure they have profiles:

/*
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
  id,
  email,
  'Teacher Name',
  'teacher',
  created_at,
  NOW()
FROM auth.users
WHERE email = 'specific.teacher@example.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'teacher', updated_at = NOW();
*/

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

-- Check if there are auth users without profiles
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Check profiles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
