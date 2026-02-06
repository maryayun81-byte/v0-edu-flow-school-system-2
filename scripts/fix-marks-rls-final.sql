-- Fix RLS Policies for Marks Table
-- This script ensures teachers can insert/update marks where they are the author (teacher_id)

BEGIN;

-- 1. Enable RLS (just in case)
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON marks;
DROP POLICY IF EXISTS "Enable insert for teachers" ON marks;
DROP POLICY IF EXISTS "Enable update for teachers" ON marks;
DROP POLICY IF EXISTS "Teachers can manage their own marks" ON marks;
DROP POLICY IF EXISTS "Admins can do everything" ON marks;
DROP POLICY IF EXISTS "Students can view their own marks" ON marks;

-- 3. Create New Policies

-- A. ADMINS: Full Access
CREATE POLICY "Admins have full access to marks"
ON marks
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- B. TEACHERS: Manage their own entries
-- We trust the 'teacher_id' column being set to auth.uid() by the client (checked via RLS)
-- Ideally, we also check if they are assigned the class, but for now, let's unblock the basic save.

CREATE POLICY "Teachers can insert their own marks"
ON marks
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = teacher_id
);

CREATE POLICY "Teachers can update their own marks"
ON marks
FOR UPDATE
TO authenticated
USING (
    auth.uid() = teacher_id
);

CREATE POLICY "Teachers can view their own marks"
ON marks
FOR SELECT
TO authenticated
USING (
    auth.uid() = teacher_id
);

-- C. STUDENTS: View their own marks
CREATE POLICY "Students can view their own marks"
ON marks
FOR SELECT
TO authenticated
USING (
    auth.uid() = student_id
);

COMMIT;
