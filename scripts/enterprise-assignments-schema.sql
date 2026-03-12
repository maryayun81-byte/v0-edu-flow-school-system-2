-- ============================================================
-- ENTERPRISE ASSIGNMENT MANAGEMENT SYSTEM - SCHEMA MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add new columns to the existing assignments table
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'WORKSHEET' CHECK (submission_type IN ('WORKSHEET','PHOTO','MIXED')),
  ADD COLUMN IF NOT EXISTS visibility_type TEXT DEFAULT 'CLASS' CHECK (visibility_type IN ('CLASS','SPECIFIC','GROUP')),
  ADD COLUMN IF NOT EXISTS tuition_event_id UUID REFERENCES tuition_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Assignment Files table (multiple resources per assignment)
CREATE TABLE IF NOT EXISTS assignment_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('QUESTION_PAPER','WORKSHEET','REFERENCE','OTHER')),
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Assignment Recipients (for targeted delivery)
CREATE TABLE IF NOT EXISTS assignment_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- 4. Submission Files (multiple uploads per submission)
CREATE TABLE IF NOT EXISTS submission_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES student_submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'PHOTO' CHECK (file_type IN ('WORKSHEET','PHOTO','OTHER')),
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Submission Annotations (teacher canvas markings)
CREATE TABLE IF NOT EXISTS submission_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES student_submissions(id) ON DELETE CASCADE,
  annotation_data JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Submission Feedback (teacher marks + strengths/weaknesses)
CREATE TABLE IF NOT EXISTS submission_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES student_submissions(id) ON DELETE CASCADE,
  score NUMERIC,
  feedback_text TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  is_returned BOOLEAN DEFAULT FALSE,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id)
);

-- 7. Student Subject Enrollments (if not already exists)
CREATE TABLE IF NOT EXISTS student_subject_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, subject_id)
);

-- 8. Add status field to student_submissions if not present
ALTER TABLE student_submissions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','MARKED','RETURNED','LATE')),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 9. Storage bucket for enterprise assignment files
INSERT INTO storage.buckets (id, name, public)
VALUES ('enterprise-assignments', 'enterprise-assignments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- RLS for enterprise-assignments bucket
DROP POLICY IF EXISTS "Auth users can upload enterprise assignments" ON storage.objects;
CREATE POLICY "Auth users can upload enterprise assignments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'enterprise-assignments');

DROP POLICY IF EXISTS "Anyone can view enterprise assignments" ON storage.objects;
CREATE POLICY "Anyone can view enterprise assignments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'enterprise-assignments');

-- 10. Indices for performance
CREATE INDEX IF NOT EXISTS idx_assignment_files_assignment ON assignment_files(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_recipients_assignment ON assignment_recipients(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_recipients_student ON assignment_recipients(student_id);
CREATE INDEX IF NOT EXISTS idx_submission_files_submission ON submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission ON submission_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_student_subject_enrollments_student ON student_subject_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subject_enrollments_class ON student_subject_enrollments(class_id);
