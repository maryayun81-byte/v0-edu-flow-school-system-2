-- ========================================
-- COMPLETE QUIZ SYSTEM DATABASE SETUP
-- This script creates all quiz-related tables from scratch with enhanced features
-- ========================================

-- ========================================
-- 1. CREATE BASE QUIZZES TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  subject_id UUID,
  class_id UUID,
  
  -- Timing and scheduling
  duration_minutes INTEGER,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  
  -- Scoring
  total_marks INTEGER DEFAULT 0,
  passing_marks INTEGER DEFAULT 0,
  points_per_question INTEGER DEFAULT 10,
  
  -- Settings
  max_attempts INTEGER DEFAULT 1,
  allow_retake BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT true,
  show_correct_answers BOOLEAN DEFAULT true,
  show_results_immediately BOOLEAN DEFAULT false,
  
  -- Status
  is_published BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for quizzes
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_published ON quizzes(is_published);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON quizzes(subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_class ON quizzes(class_id);

-- ========================================
-- 2. CREATE QUIZ_QUESTIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  
  -- Question content
  question_text TEXT NOT NULL,
  question_number INTEGER,
  question_image_url TEXT,
  question_type TEXT NOT NULL CHECK (
    question_type IN (
      'mcq_single', 
      'mcq_multiple', 
      'true_false', 
      'short_text', 
      'long_text', 
      'equation', 
      'image_based', 
      'multiple_choice', 
      'short_answer'
    )
  ),
  
  -- Options and answers (for backward compatibility)
  options JSONB, -- For multiple choice: [{"id": "a", "text": "Option A"}, ...]
  correct_answer TEXT, -- For simple question types
  
  -- Grading
  marks INTEGER DEFAULT 10,
  auto_gradable BOOLEAN DEFAULT true,
  sample_answer TEXT,
  keywords JSONB,
  
  -- Display
  order_index INTEGER DEFAULT 0,
  explanation TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for quiz_questions
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON quiz_questions(quiz_id, order_index);

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
-- 4. CREATE QUIZ_ATTEMPTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  
  -- Student information
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT,
  
  -- Attempt tracking
  attempt_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  
  -- Timing
  time_spent_seconds INTEGER,
  time_taken_seconds INTEGER, -- Backward compatibility
  
  -- Status
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  
  -- Scoring
  score INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  total_marks_obtained DECIMAL(10,2),
  auto_graded_marks DECIMAL(10,2),
  manual_graded_marks DECIMAL(10,2),
  
  -- Grading
  teacher_remarks TEXT,
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Answers (for backward compatibility)
  answers JSONB, -- {"question_id": "selected_answer", ...}
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for quiz_attempts
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_email ON quiz_attempts(student_email);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status);

-- ========================================
-- 5. CREATE QUIZ_ANSWERS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  
  -- Answer content
  selected_options JSONB, -- array of option IDs for MCQ
  text_answer TEXT,
  file_url TEXT,
  
  -- Grading
  is_correct BOOLEAN,
  marks_obtained DECIMAL(10,2),
  auto_graded BOOLEAN DEFAULT false,
  needs_manual_grading BOOLEAN DEFAULT false,
  teacher_feedback TEXT,
  
  -- Timestamps
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for quiz_answers
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_needs_grading ON quiz_answers(needs_manual_grading) 
  WHERE needs_manual_grading = true;

-- ========================================
-- 6. CREATE LEADERBOARD TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  student_email TEXT UNIQUE,
  total_points INTEGER DEFAULT 0,
  quizzes_completed INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  badges JSONB DEFAULT '[]', -- ["first_quiz", "perfect_score", "streak_7", ...]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for leaderboard
CREATE INDEX IF NOT EXISTS idx_leaderboard_points ON leaderboard(total_points DESC);

-- ========================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 8. CREATE RLS POLICIES
-- ========================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Teachers can insert quizzes" ON quizzes;
DROP POLICY IF EXISTS "Everyone can view published quizzes" ON quizzes;
DROP POLICY IF EXISTS "Teachers can update their own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Teachers can delete their own quizzes" ON quizzes;

-- Quizzes Policies
CREATE POLICY "Teachers can insert quizzes" ON quizzes
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Everyone can view published quizzes" ON quizzes
  FOR SELECT
  USING (is_published = true OR created_by = auth.uid());

CREATE POLICY "Teachers can update their own quizzes" ON quizzes
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Teachers can delete their own quizzes" ON quizzes
  FOR DELETE
  USING (created_by = auth.uid());

-- Drop existing quiz questions policies
DROP POLICY IF EXISTS "Teachers can manage quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Everyone can view questions of published quizzes" ON quiz_questions;
DROP POLICY IF EXISTS "Teachers can manage their quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Students can view questions of published quizzes" ON quiz_questions;

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
DROP POLICY IF EXISTS "Teachers can manage question options" ON quiz_question_options;
DROP POLICY IF EXISTS "Students can view options of published quizzes" ON quiz_question_options;

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

-- Drop existing quiz attempts policies
DROP POLICY IF EXISTS "Anyone can insert quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Anyone can view quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Anyone can update their own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Students can create their own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Students can view their own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Teachers can view attempts for their quizzes" ON quiz_attempts;
DROP POLICY IF EXISTS "Students can update their own attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Teachers can update attempts for grading" ON quiz_attempts;

-- Quiz Attempts Policies
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

-- Quiz Answers Policies
DROP POLICY IF EXISTS "Students can manage their own answers" ON quiz_answers;
DROP POLICY IF EXISTS "Teachers can view and grade answers" ON quiz_answers;
DROP POLICY IF EXISTS "Teachers can update answers for grading" ON quiz_answers;

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

-- Leaderboard Policies
DROP POLICY IF EXISTS "Anyone can view leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Anyone can insert to leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Anyone can update leaderboard" ON leaderboard;

CREATE POLICY "Anyone can view leaderboard" ON leaderboard
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert to leaderboard" ON leaderboard
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update leaderboard" ON leaderboard
  FOR UPDATE
  USING (true);

-- ========================================
-- 9. CREATE FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to calculate total marks for a quiz
CREATE OR REPLACE FUNCTION calculate_quiz_total_marks()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE quizzes
  SET total_marks = (
    SELECT COALESCE(SUM(marks), 0)
    FROM quiz_questions
    WHERE quiz_id = COALESCE(NEW.quiz_id, OLD.quiz_id)
  )
  WHERE id = COALESCE(NEW.quiz_id, OLD.quiz_id);
  RETURN COALESCE(NEW, OLD);
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

-- Function to update quizzes updated_at
CREATE OR REPLACE FUNCTION update_quiz_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for quizzes updated_at
DROP TRIGGER IF EXISTS quiz_updated_at_trigger ON quizzes;
CREATE TRIGGER quiz_updated_at_trigger
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_timestamp();

-- ========================================
-- 10. ENABLE REALTIME (OPTIONAL)
-- ========================================

-- Enable realtime for quiz submissions
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE quiz_attempts;
  EXCEPTION 
    WHEN duplicate_object THEN
      RAISE NOTICE 'quiz_attempts table is already enabled for realtime';
    WHEN undefined_object THEN
      RAISE NOTICE 'supabase_realtime publication does not exist, skipping realtime setup';
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
    WHEN undefined_object THEN
      RAISE NOTICE 'supabase_realtime publication does not exist, skipping realtime setup';
  END;
END $$;

-- ========================================
-- 11. ADD COMMENTS
-- ========================================

COMMENT ON TABLE quizzes IS 'Stores quiz information with enhanced features for scheduling, grading, and settings';
COMMENT ON TABLE quiz_questions IS 'Stores quiz questions with support for multiple question types and auto-grading';
COMMENT ON TABLE quiz_question_options IS 'Stores options for multiple choice questions';
COMMENT ON TABLE quiz_attempts IS 'Tracks student quiz attempts with detailed timing and grading information';
COMMENT ON TABLE quiz_answers IS 'Stores student answers with auto-grading and manual grading support';
COMMENT ON TABLE leaderboard IS 'Aggregates student performance across all quizzes';

-- ========================================
-- SETUP COMPLETE
-- ========================================

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '✅ Quiz system database setup completed successfully!';
  RAISE NOTICE '📊 Created tables: quizzes, quiz_questions, quiz_question_options, quiz_attempts, quiz_answers, leaderboard';
  RAISE NOTICE '🔒 Row Level Security enabled on all tables';
  RAISE NOTICE '⚡ Triggers and functions created for automatic calculations';
END $$;
