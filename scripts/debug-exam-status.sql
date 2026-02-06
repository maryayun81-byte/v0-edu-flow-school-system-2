-- Check if log_exam_audit function exists and test it
-- Run this to diagnose the exam status update issue

-- 1. Check if the function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'log_exam_audit';

-- 2. Check if audit_logs table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs'
) as audit_logs_exists;

-- 3. Check RLS policies on exams table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'exams';

-- 4. Check if notifications table has proper structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 5. Test creating a notification manually
-- Uncomment to test (replace with actual admin user ID)
/*
INSERT INTO notifications (
    title,
    message,
    type,
    audience,
    target_role
) VALUES (
    'Test Notification',
    'Testing notification system',
    'info',
    'teacher',
    'teacher'
);
*/
