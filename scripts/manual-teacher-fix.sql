-- =====================================================
-- MANUAL TEACHER FIX SCRIPT
-- =====================================================
-- Use this script to manually promote specific users to teachers
-- when the automatic detection fails (e.g. email doesn't contain 'teacher')
-- =====================================================

-- 1. First, list all users to find the emails/IDs
SELECT 
  u.id, 
  u.email, 
  p.role, 
  p.full_name, 
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- =====================================================
-- 2. COPY & PASTE THE EMAILS BELOW TO FIX THEM
-- =====================================================
-- Replace 'teacher@example.com' with the actual email addresses

UPDATE profiles
SET 
  role = 'teacher', 
  updated_at = NOW()
WHERE email IN (
  'teacher1@example.com',
  'teacher2@example.com',
  'example@gmail.com' -- Add your teacher emails here
);

-- =====================================================
-- 3. Verify the changes
-- =====================================================
SELECT * FROM profiles WHERE role = 'teacher';
