-- ============================================================
-- FIX: STUDENT FEEDBACK VISIBILITY & RLS POLICIES
-- Run this in Supabase SQL Editor to allow students to see their results
-- ============================================================

-- 1. Ensure RLS is enabled on all relevant tables
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;

-- 2. Student policies for student_submissions
DROP POLICY IF EXISTS "Students can view their own submissions" ON student_submissions;
CREATE POLICY "Students can view their own submissions" 
ON student_submissions FOR SELECT 
USING (student_id = auth.uid());

-- 3. Student policies for submission_feedback
DROP POLICY IF EXISTS "Students can view their own feedback" ON submission_feedback;
CREATE POLICY "Students can view their own feedback" 
ON submission_feedback FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        WHERE student_submissions.id = submission_feedback.submission_id 
        AND student_submissions.student_id = auth.uid()
    )
);

-- 4. Update Student policies for submission_annotations (ensure consistence)
DROP POLICY IF EXISTS "Students can view annotations" ON submission_annotations;
CREATE POLICY "Students can view annotations" 
ON submission_annotations FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        WHERE student_submissions.id = submission_annotations.submission_id
        AND student_submissions.student_id = auth.uid()
        AND student_submissions.status IN ('RETURNED', 'MARKED', 'GRADED')
    )
);

-- 5. Student policies for submission_files
DROP POLICY IF EXISTS "Students can view their own submission files" ON submission_files;
CREATE POLICY "Students can view their own submission files" 
ON submission_files FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        WHERE student_submissions.id = submission_files.submission_id 
        AND student_submissions.student_id = auth.uid()
    )
);

-- 6. Ensure teachers can still manage everything
-- (These should already exist from previous scripts, but re-applying for safety)
DROP POLICY IF EXISTS "Teachers manage submission feedback" ON submission_feedback;
CREATE POLICY "Teachers manage submission feedback" 
ON submission_feedback FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        JOIN assignments ON assignments.id = student_submissions.assignment_id
        WHERE student_submissions.id = submission_feedback.submission_id 
        AND assignments.teacher_id = auth.uid()
    )
);
