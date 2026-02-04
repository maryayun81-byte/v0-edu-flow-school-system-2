-- Enhanced Quiz System Database Schema
-- This script enhances the existing quiz tables with advanced features

-- ========================================
-- 1. ENHANCE QUIZZES TABLE
-- ========================================

-- Add new columns to existing quizzes table
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS class_id UUID;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS total_marks INTEGER DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS show_results_immediately BOOLEAN DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed'));

-- Rename time_limit_minutes to duration_minutes if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'time_limit_minutes'
  ) THEN
    ALTER TABLE quizzes RENAME COLUMN time_limit_minutes TO duration_minutes;
  END IF;
END $$;

-- Update scheduled columns to be more flexible
ALTER TABLE quizzes ALTER COLUMN scheduled_start DROP NOT NULL;
ALTER TABLE quizzes ALTER COLUMN scheduled_end DROP NOT NULL;

-- ========================================
-- 2. ENHANCE QUIZ_QUESTIONS TABLE
-- ========================================

-- Add new columns for advanced question types
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_number INTEGER;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_image_url TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS marks INTEGER DEFAULT 10;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS auto_gradable BOOLEAN DEFAULT true;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS sample_answer TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS keywords JSONB;

-- Expand question types
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_question_type_check 
  CHECK (question_type IN ('mcq_single', 'mcq_multiple', 'true_false', 'short_text', 'long_text', 'equation', 'image_based', 'multiple_choice', 'short_answer'));

-- Rename points to marks if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'points'
  ) THEN
    ALTER TABLE quiz_questions RENAME COLUMN points TO marks;
  END IF;
END $$;

-- ========================================
-- 3. CREATE QUIZ_QUESTION_OPTIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_image_url TEXT,
  is_correct BOOLEAN DEFAULT false,
  option_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_quiz_question_options_question_id ON quiz_question_options(question_id);

-- ========================================
-- 4. ENHANCE QUIZ_ATTEMPTS TABLE
-- ========================================

-- Add new columns for enhanced tracking
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded'));
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS total_marks_obtained DECIMAL(10,2);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS auto_graded_marks DECIMAL(10,2);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS manual_graded_marks DECIMAL(10,2);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS teacher_remarks TEXT;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Rename columns if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_attempts' AND column_name = 'time_taken_seconds'
  ) THEN
    ALTER TABLE quiz_attempts RENAME COLUMN time_taken_seconds TO time_spent_seconds;
  END IF;
END $$;

-- ========================================
-- 5. CREATE QUIZ_ANSWERS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_options JSONB, -- array of option IDs for MCQ
  text_answer TEXT,
  file_url TEXT,
  is_correct BOOLEAN,
  marks_obtained DECIMAL(10,2),
  auto_graded BOOLEAN DEFAULT false,
  needs_manual_grading BOOLEAN DEFAULT false,
  teacher_feedback TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_needs_grading ON quiz_answers(needs_manual_grading) WHERE needs_manual_grading = true;

-- ========================================
-- 6. UPDATE RLS POLICIES
-- ========================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Teachers can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Everyone can view questions of published quizzes" ON quiz_questions;

-- Quiz Questions Policies
CREATE POLICY "Teachers can manage their quiz questions" ON quiz_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
      AND quizzes.created_by = auth.uid()
    )
  );

CREATE POLICY "Students can view questions of published quizzes" ON quiz_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
      AND quizzes.is_published = true
    )
  );

-- Quiz Question Options Policies
ALTER TABLE quiz_question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage question options" ON quiz_question_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quiz_questions
      JOIN quizzes ON quizzes.id = quiz_questions.quiz_id
      WHERE quiz_questions.id = quiz_question_options.question_id
      AND quizzes.created_by = auth.uid()
    )
  );

CREATE POLICY "Students can view options of published quizzes" ON quiz_question_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_questions
      JOIN quizzes ON quizzes.id = quiz_questions.quiz_id
      WHERE quiz_questions.id = quiz_question_options.question_id
      AND quizzes.is_published = true
    )
  );

-- Quiz Answers Policies
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own answers" ON quiz_answers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      WHERE quiz_attempts.id = quiz_answers.attempt_id
      AND quiz_attempts.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view and grade answers" ON quiz_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = quiz_answers.attempt_id
      AND quizzes.created_by = auth.uid()
    )
  );

CREATE POLICY "Teachers can update answers for grading" ON quiz_answers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = quiz_answers.attempt_id
      AND quizzes.created_by = auth.uid()
    )
  );

-- Update quiz attempts policies
DROP POLICY IF EXISTS "Anyone can insert quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Anyone can view quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Anyone can update their own attempts" ON quiz_attempts;

CREATE POLICY "Students can create their own attempts" ON quiz_attempts
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own attempts" ON quiz_attempts
  FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view attempts for their quizzes" ON quiz_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_attempts.quiz_id
      AND quizzes.created_by = auth.uid()
    )
  );

CREATE POLICY "Students can update their own attempts" ON quiz_attempts
  FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can update attempts for grading" ON quiz_attempts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_attempts.quiz_id
      AND quizzes.created_by = auth.uid()
    )
  );

-- ========================================
-- 7. CREATE FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to calculate total marks for a quiz
CREATE OR REPLACE FUNCTION calculate_quiz_total_marks()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quizzes
  SET total_marks = (
    SELECT COALESCE(SUM(marks), 0)
    FROM quiz_questions
    WHERE quiz_id = NEW.quiz_id
  )
  WHERE id = NEW.quiz_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update quiz total marks when questions change
DROP TRIGGER IF EXISTS update_quiz_total_marks ON quiz_questions;
CREATE TRIGGER update_quiz_total_marks
  AFTER INSERT OR UPDATE OR DELETE ON quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quiz_total_marks();

-- Function to update quiz_answers updated_at
CREATE OR REPLACE FUNCTION update_quiz_answer_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for quiz_answers updated_at
DROP TRIGGER IF EXISTS quiz_answer_updated_at_trigger ON quiz_answers;
CREATE TRIGGER quiz_answer_updated_at_trigger
  BEFORE UPDATE ON quiz_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_answer_timestamp();

-- ========================================
-- 8. ENABLE REALTIME
-- ========================================

-- Enable realtime for quiz submissions
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE quiz_attempts;
  EXCEPTION 
    WHEN duplicate_object THEN
      RAISE NOTICE 'quiz_attempts table is already enabled for realtime';
  END;
END $$;

-- Enable realtime for quiz answers (for auto-save)
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE quiz_answers;
  EXCEPTION 
    WHEN duplicate_object THEN
      RAISE NOTICE 'quiz_answers table is already enabled for realtime';
  END;
END $$;

COMMENT ON TABLE quiz_question_options IS 'Stores options for multiple choice questions';
COMMENT ON TABLE quiz_answers IS 'Stores student answers with auto-grading and manual grading support';
