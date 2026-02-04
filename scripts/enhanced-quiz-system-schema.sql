-- Enhanced Quiz System Schema (Migration Safe)
-- Run this script to safely migrate existing quiz tables to the enhanced schema

-- ============================================================================
-- STEP 1: DROP EXISTING PROBLEMATIC TABLES (if they exist with wrong structure)
-- ============================================================================

-- Only drop if they exist and recreate with correct structure
DROP TABLE IF EXISTS quiz_analytics CASCADE;
DROP TABLE IF EXISTS quiz_answers CASCADE;
DROP TABLE IF EXISTS quiz_options CASCADE;

-- Check if quiz_submissions exists with old structure
DO $$
BEGIN
  -- If quiz_submissions exists but doesn't have submission_id, we need to recreate it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quiz_submissions') THEN
    -- Check if it has the correct structure
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'quiz_submissions' AND column_name = 'status') THEN
      -- Old structure, drop and recreate
      DROP TABLE IF EXISTS quiz_submissions CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: CREATE TABLES WITH CORRECT STRUCTURE
-- ============================================================================

-- QUIZ SUBMISSIONS TABLE (Enhanced)
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score DECIMAL(10, 2) DEFAULT 0,
  total_marks DECIMAL(10, 2) DEFAULT 0,
  percentage DECIMAL(5, 2) DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  teacher_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, student_id)
);

-- QUIZ OPTIONS TABLE (For MCQ questions)
CREATE TABLE IF NOT EXISTS quiz_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  option_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QUIZ ANSWERS TABLE (Student responses with auto-save)
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES quiz_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  selected_option_ids UUID[],
  score DECIMAL(10, 2) DEFAULT 0,
  is_correct BOOLEAN,
  teacher_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, question_id)
);

-- QUIZ ANALYTICS TABLE (Performance tracking)
CREATE TABLE IF NOT EXISTS quiz_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  total_attempts INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  average_score DECIMAL(5, 2) DEFAULT 0,
  difficulty_rating DECIMAL(3, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, question_id)
);

-- ============================================================================
-- STEP 3: ADD COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add new columns to existing quiz_questions table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'question_type') THEN
    ALTER TABLE quiz_questions ADD COLUMN question_type TEXT DEFAULT 'mcq_single';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'marks') THEN
    ALTER TABLE quiz_questions ADD COLUMN marks DECIMAL(10, 2) DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'attachment_url') THEN
    ALTER TABLE quiz_questions ADD COLUMN attachment_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'is_auto_gradable') THEN
    ALTER TABLE quiz_questions ADD COLUMN is_auto_gradable BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'allow_partial_credit') THEN
    ALTER TABLE quiz_questions ADD COLUMN allow_partial_credit BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add new columns to quizzes table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'scheduled_start_time') THEN
    ALTER TABLE quizzes ADD COLUMN scheduled_start_time TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'scheduled_end_time') THEN
    ALTER TABLE quizzes ADD COLUMN scheduled_end_time TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'auto_close_submissions') THEN
    ALTER TABLE quizzes ADD COLUMN auto_close_submissions BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'allow_retry') THEN
    ALTER TABLE quizzes ADD COLUMN allow_retry BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'max_attempts') THEN
    ALTER TABLE quizzes ADD COLUMN max_attempts INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quizzes' AND column_name = 'status') THEN
    ALTER TABLE quizzes ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quiz_options_question_id ON quiz_options(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_submission_id ON quiz_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_analytics_quiz_id ON quiz_analytics(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student_id ON quiz_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id ON quiz_submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_status ON quiz_submissions(status);

-- ============================================================================
-- STEP 5: CREATE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_quiz_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_grade_mcq_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_question_type TEXT;
  v_correct_option_ids UUID[];
  v_marks DECIMAL(10, 2);
BEGIN
  SELECT question_type, marks INTO v_question_type, v_marks
  FROM quiz_questions WHERE id = NEW.question_id;

  IF v_question_type IN ('mcq_single', 'mcq_multiple') THEN
    SELECT ARRAY_AGG(id) INTO v_correct_option_ids
    FROM quiz_options
    WHERE question_id = NEW.question_id AND is_correct = true;

    IF v_question_type = 'mcq_single' THEN
      IF NEW.selected_option_ids = v_correct_option_ids THEN
        NEW.is_correct = true;
        NEW.score = v_marks;
      ELSE
        NEW.is_correct = false;
        NEW.score = 0;
      END IF;
    ELSIF v_question_type = 'mcq_multiple' THEN
      IF NEW.selected_option_ids @> v_correct_option_ids 
         AND v_correct_option_ids @> NEW.selected_option_ids THEN
        NEW.is_correct = true;
        NEW.score = v_marks;
      ELSE
        NEW.is_correct = false;
        NEW.score = 0;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_submission_score()
RETURNS TRIGGER AS $$
DECLARE
  v_total_score DECIMAL(10, 2);
  v_total_marks DECIMAL(10, 2);
BEGIN
  SELECT 
    COALESCE(SUM(qa.score), 0),
    COALESCE(SUM(qq.marks), 0)
  INTO v_total_score, v_total_marks
  FROM quiz_answers qa
  JOIN quiz_questions qq ON qa.question_id = qq.id
  WHERE qa.submission_id = NEW.submission_id;

  UPDATE quiz_submissions
  SET score = v_total_score, total_marks = v_total_marks, 
      percentage = CASE WHEN v_total_marks > 0 THEN (v_total_score / v_total_marks * 100) ELSE 0 END,
      updated_at = NOW()
  WHERE id = NEW.submission_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: CREATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS quiz_submissions_updated_at ON quiz_submissions;
CREATE TRIGGER quiz_submissions_updated_at
  BEFORE UPDATE ON quiz_submissions
  FOR EACH ROW EXECUTE FUNCTION update_quiz_updated_at();

DROP TRIGGER IF EXISTS quiz_answers_updated_at ON quiz_answers;
CREATE TRIGGER quiz_answers_updated_at
  BEFORE UPDATE ON quiz_answers
  FOR EACH ROW EXECUTE FUNCTION update_quiz_updated_at();

DROP TRIGGER IF EXISTS auto_grade_mcq ON quiz_answers;
CREATE TRIGGER auto_grade_mcq
  BEFORE INSERT OR UPDATE ON quiz_answers
  FOR EACH ROW EXECUTE FUNCTION auto_grade_mcq_answer();

DROP TRIGGER IF EXISTS update_score_on_answer ON quiz_answers;
CREATE TRIGGER update_score_on_answer
  AFTER INSERT OR UPDATE ON quiz_answers
  FOR EACH ROW EXECUTE FUNCTION update_submission_score();

-- ============================================================================
-- STEP 7: ENABLE RLS
-- ============================================================================

ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: CREATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Students can view their own submissions" ON quiz_submissions;
CREATE POLICY "Students can view their own submissions"
ON quiz_submissions FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can create their own submissions" ON quiz_submissions;
CREATE POLICY "Students can create their own submissions"
ON quiz_submissions FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update their own submissions" ON quiz_submissions;
CREATE POLICY "Students can update their own submissions"
ON quiz_submissions FOR UPDATE USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can view all submissions" ON quiz_submissions;
CREATE POLICY "Teachers can view all submissions"
ON quiz_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin'))
);

DROP POLICY IF EXISTS "Teachers can update submissions for grading" ON quiz_submissions;
CREATE POLICY "Teachers can update submissions for grading"
ON quiz_submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin'))
);

DROP POLICY IF EXISTS "Everyone can view quiz options" ON quiz_options;
CREATE POLICY "Everyone can view quiz options"
ON quiz_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can manage quiz options" ON quiz_options;
CREATE POLICY "Teachers can manage quiz options"
ON quiz_options FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin'))
);

DROP POLICY IF EXISTS "Students can manage their own answers" ON quiz_answers;
CREATE POLICY "Students can manage their own answers"
ON quiz_answers FOR ALL USING (
  EXISTS (SELECT 1 FROM quiz_submissions WHERE quiz_submissions.id = quiz_answers.submission_id AND quiz_submissions.student_id = auth.uid())
);

DROP POLICY IF EXISTS "Teachers can view all answers" ON quiz_answers;
CREATE POLICY "Teachers can view all answers"
ON quiz_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin'))
);

DROP POLICY IF EXISTS "Teachers can update answers for grading" ON quiz_answers;
CREATE POLICY "Teachers can update answers for grading"
ON quiz_answers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'admin'))
);

DROP POLICY IF EXISTS "Everyone can view analytics" ON quiz_analytics;
CREATE POLICY "Everyone can view analytics"
ON quiz_analytics FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can update analytics" ON quiz_analytics;
CREATE POLICY "System can update analytics"
ON quiz_analytics FOR ALL USING (true);

-- ============================================================================
-- STEP 9: GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON quiz_submissions TO authenticated;
GRANT ALL ON quiz_options TO authenticated;
GRANT ALL ON quiz_answers TO authenticated;
GRANT ALL ON quiz_analytics TO authenticated;
