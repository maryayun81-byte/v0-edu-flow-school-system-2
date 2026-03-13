-- ============================================================
-- FIX: STUDENT ASSIGNMENT VISIBILITY & RESOURCE ACCESS
-- Run this in Supabase SQL Editor to allow students to see their work
-- ============================================================

-- 1. Grant Students permission to read assignment_recipients
-- This allows the frontend to fetch specific assignments targeted to the student
DROP POLICY IF EXISTS "Students can view their own assignment recipients" ON assignment_recipients;
CREATE POLICY "Students can view their own assignment recipients" 
ON assignment_recipients FOR SELECT 
USING (student_id = auth.uid());

-- 2. Update Assignments RLS Policy 
-- Allow students to see assignments that are:
-- a) PUBLISHED AND (in their class OR they are an explicit recipient)
DROP POLICY IF EXISTS "Students see assignments for their class" ON assignments;
CREATE POLICY "Students see assignments for their class and targeted delivery" 
ON assignments FOR SELECT 
USING (
    status = 'PUBLISHED' 
    AND (
        EXISTS (
            SELECT 1 FROM student_classes 
            WHERE student_classes.student_id = auth.uid() 
            AND student_classes.class_id = assignments.class_id
        )
        OR
        EXISTS (
            SELECT 1 FROM assignment_recipients
            WHERE assignment_recipients.student_id = auth.uid()
            AND assignment_recipients.assignment_id = assignments.id
        )
    )
);

-- 3. Grant Students permission to view assignment_files
-- Only for assignments they have permission to see
DROP POLICY IF EXISTS "Students can view assignment files" ON assignment_files;
CREATE POLICY "Students can view assignment files" 
ON assignment_files FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_id 
        AND status = 'PUBLISHED'
        AND (
            EXISTS (
                SELECT 1 FROM student_classes 
                WHERE student_classes.student_id = auth.uid() 
                AND student_classes.class_id = assignments.class_id
            )
            OR
            EXISTS (
                SELECT 1 FROM assignment_recipients
                WHERE assignment_recipients.student_id = auth.uid()
                AND assignment_recipients.assignment_id = assignments.id
            )
        )
    )
);

-- 4. Indices for performance optimization
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
