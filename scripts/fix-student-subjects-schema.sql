-- Student Subjects Table Setup
-- This table stores the subjects that each student has registered for

-- Create student_subjects table
CREATE TABLE IF NOT EXISTS student_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id ON student_subjects(student_id);

-- Enable RLS
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Students can view their own subjects" ON student_subjects;
DROP POLICY IF EXISTS "Students can insert their own subjects" ON student_subjects;
DROP POLICY IF EXISTS "Students can update their own subjects" ON student_subjects;
DROP POLICY IF EXISTS "Students can delete their own subjects" ON student_subjects;
DROP POLICY IF EXISTS "Teachers and admins can view all subjects" ON student_subjects;

-- Policy 1: Students can view their own subjects
CREATE POLICY "Students can view their own subjects"
ON student_subjects FOR SELECT
USING (student_id = auth.uid());

-- Policy 2: Students can insert their own subjects
CREATE POLICY "Students can insert their own subjects"
ON student_subjects FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Policy 3: Students can update their own subjects
CREATE POLICY "Students can update their own subjects"
ON student_subjects FOR UPDATE
USING (student_id = auth.uid());

-- Policy 4: Students can delete their own subjects
CREATE POLICY "Students can delete their own subjects"
ON student_subjects FOR DELETE
USING (student_id = auth.uid());

-- Policy 5: Teachers and admins can view all subjects
CREATE POLICY "Teachers and admins can view all subjects"
ON student_subjects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('teacher', 'admin')
  )
);

-- Grant permissions
GRANT ALL ON student_subjects TO authenticated;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_student_subjects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_subjects_updated_at ON student_subjects;
CREATE TRIGGER student_subjects_updated_at
  BEFORE UPDATE ON student_subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_student_subjects_updated_at();
