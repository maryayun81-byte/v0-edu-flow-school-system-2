-- Add missing values to submission_status_enum
ALTER TYPE submission_status_enum ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE submission_status_enum ADD VALUE IF NOT EXISTS 'GRADED';

-- Add structured feedback fields to student_submissions
ALTER TABLE student_submissions 
ADD COLUMN IF NOT EXISTS weaknesses JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS improvement_suggestions JSONB DEFAULT '[]';

-- Ensure students can view annotations once the assignment is returned
-- NOTE: We cast ss.status to TEXT to allow this script to run in one go, 
-- bypassing the Postgres "unsafe use of new enum value" error.
DROP POLICY IF EXISTS "Students can view annotations" ON submission_annotations;
CREATE POLICY "Students can view annotations" ON submission_annotations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM student_submissions ss
        WHERE ss.id = submission_annotations.submission_id
        AND ss.student_id = auth.uid()
        AND ss.status::text IN ('RETURNED', 'MARKED', 'GRADED')
    )
);


