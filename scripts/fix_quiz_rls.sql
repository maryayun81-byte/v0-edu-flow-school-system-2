-- ============================================================
-- FIX QUIZ RLS PERMISSIONS
-- Optimized for Senior Engineering Standards: Role-based + Owner-safe
-- ============================================================

-- 1. Enable RLS (Ensure it's on)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy restrictive policies
DROP POLICY IF EXISTS "Teachers can insert quizzes" ON quizzes;
DROP POLICY IF EXISTS "Everyone can view published quizzes" ON quizzes;
DROP POLICY IF EXISTS "Teachers can update their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Teachers can delete their own quizzes" ON quizzes;

-- 3. Implement Robust Quiz Policies
-- INSERT: Allow if user has teacher/admin role and is setting themselves as owner
CREATE POLICY "Allow authorized users to create quizzes" ON quizzes
  FOR INSERT
  WITH CHECK (
    (auth.uid() = created_by OR created_by IS NULL) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('teacher', 'admin', 'super_admin')
    )
  );

-- SELECT: Owners can see all, others see published
CREATE POLICY "Allow users to view appropriate quizzes" ON quizzes
  FOR SELECT
  USING (
    is_published = true OR 
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Owners and admins can update
CREATE POLICY "Allow owners and admins to update quizzes" ON quizzes
  FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- DELETE: Owners and admins can delete
CREATE POLICY "Allow owners and admins to delete quizzes" ON quizzes
  FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- 4. Fix Quiz Questions Policies
DROP POLICY IF EXISTS "Teachers can manage their quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Students can view questions of published quizzes" ON quiz_questions;

CREATE POLICY "Manage quiz questions" ON quiz_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
      AND (
        quizzes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "View quiz questions" ON quiz_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
      AND (
        quizzes.is_published = true OR
        quizzes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
        )
      )
    )
  );

-- 5. Ensure created_by defaults to auth.uid() if missing
ALTER TABLE quizzes ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 6. Add Audit Comment
COMMENT ON TABLE quizzes IS 'Quiz table with robust role-based RLS [Fixed 2024 by Senior Engineer]';
