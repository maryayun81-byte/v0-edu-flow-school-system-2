-- Fix Student Class Matching Issue
-- This script helps align student form_class values with actual class names

-- Step 1: See what class exists and what students have
SELECT 'Current class in database:' as info, id, name FROM classes;

SELECT 'Students and their form_class values:' as info, 
       id, full_name, form_class, role 
FROM profiles 
WHERE role = 'student' AND form_class IS NOT NULL;

-- Step 2: OPTION A - Update students to match the existing class
-- Uncomment and modify the class name to match your actual class name from Step 1
-- UPDATE profiles 
-- SET form_class = 'YOUR_CLASS_NAME_HERE'  -- Replace with actual class name from above
-- WHERE role = 'student' AND form_class IS NOT NULL;

-- Step 3: OPTION B - Create classes to match student form_class values
-- This creates classes for each unique form_class that students have
-- Uncomment to run:
-- INSERT INTO classes (name, created_at, updated_at)
-- SELECT DISTINCT 
--   form_class,
--   NOW(),
--   NOW()
-- FROM profiles 
-- WHERE role = 'student' 
--   AND form_class IS NOT NULL
--   AND form_class NOT IN (SELECT name FROM classes)
-- ON CONFLICT (name) DO NOTHING;

-- Step 4: Verify the fix
-- Run this after applying OPTION A or B to confirm students now match classes
SELECT 
  p.full_name as student_name,
  p.form_class as student_form_class,
  c.name as matching_class_name,
  CASE 
    WHEN c.id IS NOT NULL THEN '✓ Matched'
    ELSE '✗ No match'
  END as status
FROM profiles p
LEFT JOIN classes c ON c.name = p.form_class
WHERE p.role = 'student' AND p.form_class IS NOT NULL
ORDER BY status, p.full_name;
