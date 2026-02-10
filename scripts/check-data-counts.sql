-- CHECK DATA COUNTS
-- This script safely counts rows in the key messaging tables to verify data exists.

SELECT 'profiles' as table_name, count(*) FROM profiles UNION ALL
SELECT 'classes', count(*) FROM classes UNION ALL
SELECT 'student_classes', count(*) FROM student_classes UNION ALL
SELECT 'teacher_classes', count(*) FROM teacher_classes UNION ALL
SELECT 'conversations', count(*) FROM conversations UNION ALL
SELECT 'messages', count(*) FROM messages;
