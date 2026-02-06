-- Quick fix: Ensure admins can update exams
-- Run this if RLS is blocking admin updates

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can update exams" ON exams;
DROP POLICY IF EXISTS "Admins can manage exams" ON exams;

-- Create comprehensive admin policy for exams
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

-- Verify the policy was created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'exams' AND policyname LIKE '%admin%';
