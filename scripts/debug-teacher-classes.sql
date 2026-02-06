-- Check teacher classes assignments
-- Replace 'teacher@example.com' with the email of the teacher you are testing with
-- Or just run this to see ALL teacher assignments

SELECT 
    p.email, 
    p.full_name, 
    c.name as class_name, 
    tc.subjects
FROM teacher_classes tc
JOIN profiles p ON p.id = tc.teacher_id
JOIN classes c ON c.id = tc.class_id;

-- Also check if there are any profiles with role 'teacher' but NO classes
SELECT email, full_name, id 
FROM profiles 
WHERE role = 'teacher' 
AND id NOT IN (SELECT teacher_id FROM teacher_classes);
