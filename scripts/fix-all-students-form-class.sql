-- Check and Fix Current Student's form_class

-- Step 1: See which students are missing form_class
SELECT 'Students WITHOUT form_class:' as info,
       id, full_name, email, form_class, role
FROM profiles
WHERE role = 'student' AND (form_class IS NULL OR form_class = '');

-- Step 2: See what class exists to assign them to
SELECT 'Available class:' as info, id, name FROM classes;

-- Step 3: Update ALL students without form_class to use the existing class
UPDATE profiles
SET form_class = (SELECT name FROM classes LIMIT 1),
    updated_at = NOW()
WHERE role = 'student' 
  AND (form_class IS NULL OR form_class = '');

-- Step 4: Verify all students now have form_class
SELECT 'All students after fix:' as info,
       id, full_name, form_class, 
       CASE 
         WHEN form_class IS NOT NULL THEN '✓ Has class'
         ELSE '✗ Missing class'
       END as status
FROM profiles
WHERE role = 'student'
ORDER BY full_name;

-- Step 5: Verify timetable access for all students
SELECT 
  p.full_name as student_name,
  p.form_class,
  c.name as class_name,
  COUNT(ts.id) as timetable_sessions
FROM profiles p
LEFT JOIN classes c ON c.name = p.form_class
LEFT JOIN timetable_sessions ts ON ts.class_id = c.id AND ts.status IN ('published', 'locked')
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.form_class, c.name
ORDER BY p.full_name;
