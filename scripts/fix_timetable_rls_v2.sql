-- Fix Timetable RLS and Enrollment Logic (Robust Version)
-- This script fixes the brittle string-based class matching and implements subject-level filtering.

-- 1. Metadata RLS (Robust)
DROP POLICY IF EXISTS "admin_full_access_metadata" ON timetable_metadata;
DROP POLICY IF EXISTS "teacher_read_metadata" ON timetable_metadata;
DROP POLICY IF EXISTS "student_read_metadata" ON timetable_metadata;

CREATE POLICY "admin_full_access_metadata" ON timetable_metadata
  FOR ALL USING (public.is_admin());

CREATE POLICY "teacher_read_metadata" ON timetable_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teacher_classes
      WHERE teacher_id = auth.uid()
      AND class_id = timetable_metadata.class_id
    )
  );

CREATE POLICY "student_read_metadata" ON timetable_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM student_classes
      WHERE student_id = auth.uid()
      AND class_id = timetable_metadata.class_id
    )
  );

-- 2. Sessions RLS (Robust & Subject-Filtered)
DROP POLICY IF EXISTS "admin_full_access_sessions" ON timetable_sessions;
DROP POLICY IF EXISTS "teacher_read_own_sessions" ON timetable_sessions;
DROP POLICY IF EXISTS "student_read_class_sessions" ON timetable_sessions;

CREATE POLICY "admin_full_access_sessions" ON timetable_sessions
  FOR ALL USING (public.is_admin());

CREATE POLICY "teacher_read_own_sessions" ON timetable_sessions
  FOR SELECT USING (
    teacher_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM teacher_classes
      WHERE teacher_id = auth.uid()
      AND class_id = timetable_sessions.class_id
    )
  );

-- Student policy: MUST be in the class AND taking the subject
CREATE POLICY "student_read_class_sessions" ON timetable_sessions
  FOR SELECT USING (
    status IN ('published', 'locked')
    AND EXISTS (
      SELECT 1 FROM student_classes
      WHERE student_id = auth.uid()
      AND class_id = timetable_sessions.class_id
    )
    AND (
      -- If student_subjects system is active, filter by subject
      NOT EXISTS (SELECT 1 FROM student_subjects WHERE student_id = auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM student_subjects
        WHERE student_id = auth.uid()
        AND subject_name = timetable_sessions.subject
      )
      OR
      -- Fallback to profile subjects if student_subjects is empty
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (subjects @> ARRAY[timetable_sessions.subject])
      )
    )
  );

-- 3. Cleanup existing sessions if needed (Optional: ensures status is valid)
UPDATE timetable_sessions SET status = 'draft' WHERE status IS NULL;
UPDATE timetable_metadata SET status = 'draft' WHERE status IS NULL;
