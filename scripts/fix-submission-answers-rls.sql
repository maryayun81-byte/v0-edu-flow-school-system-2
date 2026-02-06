-- Fix RLS policies for submission_answers
-- The error "new row violates row-level security policy for table submission_answers" occurs
-- because there is no policy allowing students to insert records into this table.

-- 1. Enable RLS (ensure it is on)
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Students can insert own answers" ON submission_answers;
DROP POLICY IF EXISTS "Students can view own answers" ON submission_answers;
DROP POLICY IF EXISTS "Teachers can view answers for their assignments" ON submission_answers;

-- 3. Create Policy: Allow students to INSERT answers for their own submissions
CREATE POLICY "Students can insert own answers" 
ON submission_answers FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM student_submissions ss
        WHERE ss.id = submission_id 
        AND ss.student_id = auth.uid()
    )
);

-- 4. Create Policy: Allow students to SELECT (view) their own answers (for review mode)
CREATE POLICY "Students can view own answers" 
ON submission_answers FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions ss
        WHERE ss.id = submission_id 
        AND ss.student_id = auth.uid()
    )
);

-- 5. Create Policy: Allow teachers to VIEW answers for assignments they created
CREATE POLICY "Teachers can view answers for their assignments" 
ON submission_answers FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions ss
        JOIN assignments a ON a.id = ss.assignment_id
        WHERE ss.id = submission_id 
        AND a.teacher_id = auth.uid()
    )
);
