-- Debug Timetable Visibility
-- 1. Check Class details for "form 3" (or "Form 3")
SELECT id, name FROM classes WHERE name ILIKE 'form 3';

-- 2. Check Timetable Sessions for Form 3
SELECT 
    ts.id,
    ts.day_of_week,
    ts.start_time,
    ts.subject,
    c.name as class_name,
    ts.status
FROM timetable_sessions ts
JOIN classes c ON ts.class_id = c.id
WHERE c.name ILIKE 'form 3';

-- 3. Check Student Profile for Form 3 students and their subjects
SELECT id, full_name, form_class, subjects
FROM profiles
WHERE form_class ILIKE 'form 3'
LIMIT 5;
