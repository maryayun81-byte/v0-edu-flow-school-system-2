-- DEBUG MESSAGING DATA
-- run this to see if we have the necessary data for contacts to appear

-- 1. Check Counts
SELECT 'profiles' as table_name, count(*) FROM profiles UNION ALL
SELECT 'classes', count(*) FROM classes UNION ALL
SELECT 'student_classes', count(*) FROM student_classes UNION ALL
SELECT 'teacher_classes', count(*) FROM teacher_classes UNION ALL
SELECT 'conversations', count(*) FROM conversations UNION ALL
SELECT 'messages', count(*) FROM messages;

-- 2. Check for a sample Teacher and their classes
SELECT 
    t.id as teacher_id, 
    t.full_name, 
    c.name as class_name
FROM teacher_classes tc
JOIN profiles t ON tc.teacher_id = t.id
JOIN classes c ON tc.class_id = c.id
LIMIT 5;

-- 3. Check for a sample Student and their classes
SELECT 
    s.id as student_id, 
    s.full_name, 
    c.name as class_name
FROM student_classes sc
JOIN profiles s ON sc.student_id = s.id
JOIN classes c ON sc.class_id = c.id
LIMIT 5;

-- 4. Test RLS on messages (as anonymous/system mostly, but good to check policy existence)
SELECT * FROM pg_policies WHERE tablename = 'messages';

-- 5. Test RLS on conversations
SELECT * FROM pg_policies WHERE tablename = 'conversations';
