-- COMPREHENSIVE FIX: Admin Permissions for Exams
-- Run this to allow admins to CREATE (Insert), READ, UPDATE, and DELETE exams

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can update exams" ON exams;
DROP POLICY IF EXISTS "Admins can manage exams" ON exams;
DROP POLICY IF EXISTS "Admins have full access to exams" ON exams;
DROP POLICY IF EXISTS "Enable all for admins" ON exams;

-- 2. Create a single, powerful policy for Admins covering ALL operations
CREATE POLICY "Admins have full access to exams"
ON exams
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- 3. Ensure Teachers and Students can still VIEW exams (Select only)
DROP POLICY IF EXISTS "Everyone can view exams" ON exams;
DROP POLICY IF EXISTS "Authenticated users can view exams" ON exams;

CREATE POLICY "Authenticated users can view exams"
ON exams
FOR SELECT
TO authenticated
USING (true);

-- 4. Verify policies
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'exams';
