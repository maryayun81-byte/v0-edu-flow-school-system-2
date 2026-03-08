-- Fix transcript visibility by allowing students to see Closed and Finalized exams
-- This is necessary because transcripts are linked to exams, and inner joins fail
-- if the student cannot see the linked exam.

DROP POLICY IF EXISTS "Students can view active exams" ON exams;

CREATE POLICY "Students can view active and closed exams"
  ON exams
  FOR SELECT
  USING (
    status IN ('Active', 'Closed', 'Finalized')
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'student'
    )
  );
