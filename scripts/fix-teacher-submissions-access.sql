-- ============================================================
-- FIX: TEACHER PERMISSIONS FOR SUBMISSIONS (RLS)
-- Run this in Supabase SQL Editor to enable visibility
-- ============================================================

-- 1. Ensure RETURNED status is valid in enum
DO $$ 
BEGIN
    ALTER TYPE submission_status_enum ADD VALUE 'RETURNED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Grant Teachers permissions to view and update student_submissions
DROP POLICY IF EXISTS "Teachers view submissions" ON student_submissions;
CREATE POLICY "Teachers view submissions" 
ON student_submissions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = student_submissions.assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Teachers grade submissions" ON student_submissions;
CREATE POLICY "Teachers grade submissions" 
ON student_submissions FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = student_submissions.assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
);

-- 3. Grant Teachers permissions to view assignment recipients
DROP POLICY IF EXISTS "Teachers view assignment recipients" ON assignment_recipients;
CREATE POLICY "Teachers view assignment recipients" 
ON assignment_recipients FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_recipients.assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
);

-- 4. Grant Teachers permissions for submission files
DROP POLICY IF EXISTS "Teachers view submission files" ON submission_files;
CREATE POLICY "Teachers view submission files" 
ON submission_files FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        JOIN assignments ON assignments.id = student_submissions.assignment_id
        WHERE student_submissions.id = submission_files.submission_id 
        AND assignments.teacher_id = auth.uid()
    )
);

-- 5. Grant Teachers full management of feedback
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

-- 6. STORAGE: Explicit access for teachers to enterprise-assignments bucket
-- Note: Requires permissions on storage.objects
DROP POLICY IF EXISTS "Teachers can view enterprise objects" ON storage.objects;
CREATE POLICY "Teachers can view enterprise objects"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'enterprise-assignments');

DROP POLICY IF EXISTS "Teachers can upload to enterprise" ON storage.objects;
CREATE POLICY "Teachers can upload to enterprise"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'enterprise-assignments');

-- 7. Indices to ensure these RLS EXISTS checks are fast
CREATE INDEX IF NOT EXISTS idx_student_submissions_assignment_id ON student_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission_id ON submission_feedback(submission_id);
