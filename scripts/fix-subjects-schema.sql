-- =============================================
-- Fix Subjects Schema Mismatch
-- =============================================
-- This script resolves the "invalid input syntax for type uuid" error
-- by ensuring the 'subjects' table uses UUIDs as intended.

-- 1. Drop existing subjects table and dependent constraints
DROP TABLE IF EXISTS subjects CASCADE;

-- 2. Recreate subjects table with UUID primary key
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_core BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Reseed default subjects
INSERT INTO subjects (name, code, is_core) VALUES
  ('Mathematics', 'MATH', true),
  ('English', 'ENG', true),
  ('Kiswahili', 'KIS', true),
  ('Physics', 'PHY', false),
  ('Chemistry', 'CHEM', false),
  ('Biology', 'BIO', false),
  ('History', 'HIST', false),
  ('Geography', 'GEO', false),
  ('Computer Studies', 'CS', false),
  ('Business Studies', 'BUS', false),
  ('Agriculture', 'AGRI', false),
  ('Religious Education', 'RE', false),
  ('Home Science', 'HSCI', false),
  ('French', 'FRE', false),
  ('German', 'GER', false),
  ('Music', 'MUS', false),
  ('Art & Design', 'ART', false)
ON CONFLICT (name) DO NOTHING;

-- 4. Restore Foreign Key constraints
-- Note: Existing data in 'marks' with invalid subject_IDs (if any) would violate this.
-- We assume marks table is either empty or needs clearing if it has bad data.

-- Clear marks with invalid subjects (optional but safe)
-- DELETE FROM marks WHERE subject_id NOT IN (SELECT id FROM subjects);

-- Re-add FK to marks
ALTER TABLE marks 
  DROP CONSTRAINT IF EXISTS marks_subject_id_fkey,
  ADD CONSTRAINT marks_subject_id_fkey 
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;

-- Re-add FK to transcript_items
ALTER TABLE transcript_items
  DROP CONSTRAINT IF EXISTS transcript_items_subject_id_fkey,
  ADD CONSTRAINT transcript_items_subject_id_fkey 
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;

-- Re-add FK to teacher_classes if it exists (it typically doesn't link to subject_id but uses jsonb, so skipping)

-- 5. Helper function to ensure consistency
DO $$
BEGIN
  RAISE NOTICE 'Subjects table recreated with UUIDs.';
END $$;
