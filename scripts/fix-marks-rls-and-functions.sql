-- =============================================
-- Fix Marks RLS and Helper Functions
-- =============================================
-- This script fixes the "invalid input syntax for type uuid" error caused by 
-- incorrectly casting subject names to UUIDs in RLS policies and functions.

-- 1. FIX RLS POLICY
-- Problem: The policy was casting 'Maths' (text) to UUID directly.
-- Solution: Join with subjects table to map Name -> UUID.

DROP POLICY IF EXISTS "Teachers can manage marks for their subjects" ON marks;

CREATE POLICY "Teachers can manage marks for their subjects"
  ON marks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teacher_classes tc ON tc.teacher_id = p.id
      WHERE p.id = auth.uid()
      AND p.role = 'teacher'
      AND tc.class_id = marks.class_id
      AND marks.subject_id IN (
        SELECT s.id 
        FROM subjects s 
        WHERE s.name IN (
            SELECT jsonb_array_elements_text(tc.subjects)
        )
      )
      AND EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = marks.exam_id 
        AND exams.status IN ('Closed', 'Finalized')
      )
    )
  );

-- 2. FIX FUNCTION: get_missing_marks
-- Problem: Same bad cast logic.

CREATE OR REPLACE FUNCTION get_missing_marks(p_exam_id UUID)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  subject_id UUID,
  subject_name TEXT,
  total_students INTEGER,
  marked_students INTEGER,
  missing_count INTEGER,
  responsible_teacher_id UUID,
  responsible_teacher_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as class_id,
    c.name as class_name,
    s.id as subject_id,
    s.name as subject_name,
    (SELECT COUNT(*) FROM student_classes WHERE class_id = c.id)::INTEGER as total_students,
    COUNT(DISTINCT m.student_id)::INTEGER as marked_students,
    ((SELECT COUNT(*) FROM student_classes WHERE class_id = c.id) - COUNT(DISTINCT m.student_id))::INTEGER as missing_count,
    tc.teacher_id as responsible_teacher_id,
    p.full_name as responsible_teacher_name
  FROM classes c
  CROSS JOIN subjects s
  -- FIXED JOIN LOGIC BELOW
  LEFT JOIN teacher_classes tc ON tc.class_id = c.id 
    AND s.name IN (SELECT jsonb_array_elements_text(tc.subjects))
  LEFT JOIN profiles p ON p.id = tc.teacher_id
  LEFT JOIN marks m ON m.exam_id = p_exam_id AND m.class_id = c.id AND m.subject_id = s.id
  WHERE c.id = ANY((SELECT applicable_classes FROM exams WHERE id = p_exam_id))
  GROUP BY c.id, c.name, s.id, s.name, tc.teacher_id, p.full_name
  HAVING COUNT(DISTINCT m.student_id) < (SELECT COUNT(*) FROM student_classes WHERE class_id = c.id);
END;
$$;

-- 3. FIX FUNCTION: are_marks_complete
-- Problem: Same bad cast logic.

CREATE OR REPLACE FUNCTION are_marks_complete(p_exam_id UUID, p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_students INTEGER;
  v_total_subjects INTEGER;
  v_total_marks INTEGER;
  v_expected_marks INTEGER;
BEGIN
  -- Get total students in class
  SELECT COUNT(*) INTO v_total_students
  FROM student_classes
  WHERE class_id = p_class_id;
  
  -- Get total subjects for this class (FIXED)
  -- We count distinct subject names in teacher_classes
  SELECT COUNT(DISTINCT subject_name) INTO v_total_subjects
  FROM (
      SELECT jsonb_array_elements_text(subjects) as subject_name
      FROM teacher_classes
      WHERE class_id = p_class_id
  ) as sub;
  
  -- Get total marks entered
  SELECT COUNT(*) INTO v_total_marks
  FROM marks
  WHERE exam_id = p_exam_id
  AND class_id = p_class_id;
  
  -- Expected marks = students × subjects
  v_expected_marks := v_total_students * v_total_subjects;
  
  RETURN v_total_marks >= v_expected_marks;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Fixed RLS policies and functions for logic.';
END $$;
