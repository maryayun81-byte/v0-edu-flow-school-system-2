-- Ensure 'exams' table is readable by everyone (or at least authenticated users)
-- This is critical for the `exams!inner` join to work in StudentResults

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Drop existing if any to avoid conflict
DROP POLICY IF EXISTS "Authenticated users can view exams" ON exams;

CREATE POLICY "Authenticated users can view exams"
  ON exams
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );

-- Also double check subject RLS just in case items join on subjects later
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON subjects;
CREATE POLICY "Authenticated users can view subjects"
  ON subjects
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
  );
