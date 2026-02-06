-- Emergency diagnostic: Check exam update permissions
-- Run this to see why admin can't close exams

-- 1. Check RLS policies on exams table
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'exams';

-- 2. Check if you can manually update an exam status
-- Replace 'YOUR_EXAM_ID' with the actual exam ID you're trying to close
/*
UPDATE exams 
SET status = 'Closed'
WHERE id = 'YOUR_EXAM_ID';
*/

-- 3. Check current user's role
SELECT 
    id,
    email,
    role,
    full_name
FROM profiles
WHERE id = auth.uid();

-- 4. Test if the trigger fires
-- This will show if notifications are being created
SELECT COUNT(*) as notification_count
FROM notifications
WHERE created_at > NOW() - INTERVAL '1 hour';
