-- Student Timetable Diagnostic Script
-- Run this in your Supabase SQL Editor to diagnose why student timetable is not showing

-- 1. Check if there are any classes in the classes table
SELECT 'Classes in database:' as check_type, id, name, created_at 
FROM classes 
ORDER BY created_at DESC;

-- 2. Check if there are any published timetable sessions
SELECT 'Published timetable sessions:' as check_type, 
       ts.id, 
       ts.class_id, 
       c.name as class_name,
       ts.subject, 
       ts.day_of_week, 
       ts.start_time, 
       ts.end_time,
       ts.status,
       ts.teacher_id
FROM timetable_sessions ts
LEFT JOIN classes c ON c.id = ts.class_id
WHERE ts.status IN ('published', 'locked')
ORDER BY ts.day_of_week, ts.start_time;

-- 3. Check student profiles and their form_class values
SELECT 'Student profiles:' as check_type,
       p.id,
       p.full_name,
       p.form_class,
       p.role,
       p.created_at
FROM profiles p
WHERE p.role = 'student'
ORDER BY p.created_at DESC
LIMIT 10;

-- 4. Check if student form_class matches any class names
SELECT 'Form class matches:' as check_type,
       p.full_name as student_name,
       p.form_class as student_form_class,
       c.id as matching_class_id,
       c.name as matching_class_name,
       COUNT(ts.id) as session_count
FROM profiles p
LEFT JOIN classes c ON c.name = p.form_class
LEFT JOIN timetable_sessions ts ON ts.class_id = c.id AND ts.status IN ('published', 'locked')
WHERE p.role = 'student'
GROUP BY p.id, p.full_name, p.form_class, c.id, c.name
ORDER BY p.created_at DESC
LIMIT 10;

-- 5. Summary of the issue
SELECT 
  (SELECT COUNT(*) FROM classes) as total_classes,
  (SELECT COUNT(*) FROM timetable_sessions WHERE status IN ('published', 'locked')) as published_sessions,
  (SELECT COUNT(*) FROM profiles WHERE role = 'student') as total_students,
  (SELECT COUNT(*) FROM profiles WHERE role = 'student' AND form_class IS NOT NULL) as students_with_form_class,
  (SELECT COUNT(DISTINCT p.id) 
   FROM profiles p 
   INNER JOIN classes c ON c.name = p.form_class 
   WHERE p.role = 'student') as students_with_matching_class;
