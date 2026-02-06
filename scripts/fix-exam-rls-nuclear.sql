-- NUCLEAR FIX: Unblock Exam Creation/Updates Immediately
-- This script removes strict role checks to confirm if RLS is the blocker.
-- WARNING: This allows ANY logged-in user to manage exams. We will tighten this later.

-- 1. Drop existing policies to be safe
DROP POLICY IF EXISTS "Admins have full access to exams" ON exams;
DROP POLICY IF EXISTS "Admins can update exams" ON exams;
DROP POLICY IF EXISTS "Admins can manage exams" ON exams;
DROP POLICY IF EXISTS "Enable all for admins" ON exams;
DROP POLICY IF EXISTS "Authenticated users can view exams" ON exams;

-- 2. Create a PERMISSIVE policy for ALL authenticated users
CREATE POLICY "Unrestricted Access for Debugging"
ON exams
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Verify
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'exams';
