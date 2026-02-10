-- DEBUG CONTACT FETCHING
-- Run this to see what the functions return for a specific user.
-- Replace 'THE_USER_ID' with a valid UUID from your profiles table.

-- 1. Get a Teacher ID to test
WITH teacher AS (SELECT id FROM profiles WHERE role = 'teacher' LIMIT 1)
SELECT * FROM get_teacher_messageable_students((SELECT id FROM teacher));

-- 2. Get a Student ID to test
WITH student AS (SELECT id FROM profiles WHERE role = 'student' LIMIT 1)
SELECT * FROM get_student_messageable_classmates((SELECT id FROM student));

-- 3. Get Student's Teachers
WITH student AS (SELECT id FROM profiles WHERE role = 'student' LIMIT 1)
SELECT * FROM get_student_messageable_teachers((SELECT id FROM student));
