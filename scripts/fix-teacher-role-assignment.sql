-- =====================================================
-- FIX TEACHER ROLE ASSIGNMENT
-- =====================================================
-- This fixes teacher accounts that were incorrectly assigned 'student' role
-- =====================================================

-- Step 1: Check current state
SELECT 
  'Before Fix' as status,
  COUNT(*) FILTER (WHERE p.role = 'student' AND u.raw_user_meta_data->>'role' = 'teacher') as teachers_with_wrong_role,
  COUNT(*) FILTER (WHERE p.role = 'teacher') as correct_teachers
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id;

-- Step 2: Fix existing teacher accounts
-- Update profiles where auth metadata says 'teacher' but profile says 'student'
UPDATE profiles p
SET 
  role = 'teacher',
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND p.role = 'student'
  AND u.raw_user_meta_data->>'role' = 'teacher';

-- Step 3: Verify the fix
SELECT 
  'After Fix' as status,
  COUNT(*) FILTER (WHERE p.role = 'student' AND u.raw_user_meta_data->>'role' = 'teacher') as teachers_with_wrong_role,
  COUNT(*) FILTER (WHERE p.role = 'teacher') as correct_teachers
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id;

-- Step 4: Show all teachers
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.role as profile_role,
  u.raw_user_meta_data->>'role' as auth_role,
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'teacher'
ORDER BY p.created_at DESC;
