-- Fix Student Class Matching - Option A
-- This updates all students to use the existing class name

-- Step 1: First, let's see what we have
SELECT 'Existing class:' as info, id, name FROM classes LIMIT 1;

SELECT 'Students with form_class:' as info, 
       id, full_name, form_class 
FROM profiles 
WHERE role = 'student' AND form_class IS NOT NULL;

-- Step 2: Update all students to match the existing class
-- Replace 'PASTE_CLASS_NAME_HERE' with the exact class name from Step 1 above
UPDATE profiles 
SET form_class = (SELECT name FROM classes LIMIT 1)
WHERE role = 'student' AND form_class IS NOT NULL;

-- Step 3: Verify the fix worked
SELECT 
  p.full_name as student_name,
  p.form_class as updated_form_class,
  c.name as matching_class_name,
  '✓ Fixed!' as status
FROM profiles p
INNER JOIN classes c ON c.name = p.form_class
WHERE p.role = 'student'
ORDER BY p.full_name;

-- Step 4: Check timetable sessions are now accessible
SELECT 
  p.full_name as student_name,
  COUNT(ts.id) as timetable_sessions_count
FROM profiles p
INNER JOIN classes c ON c.name = p.form_class
LEFT JOIN timetable_sessions ts ON ts.class_id = c.id AND ts.status IN ('published', 'locked')
WHERE p.role = 'student'
GROUP BY p.id, p.full_name
ORDER BY p.full_name;
