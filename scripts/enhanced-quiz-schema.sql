-- ========================================
-- ENHANCED QUIZ SYSTEM DATABASE SCHEMA
-- This script adds advanced features to the existing quiz system
-- Run this AFTER complete-quiz-system-setup.sql
-- ========================================

-- ========================================
-- 1. EXTEND QUIZ_QUESTIONS TABLE
-- ========================================

-- Add advanced question type support
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_latex TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS grading_mode TEXT DEFAULT 'auto' 
  CHECK (grading_mode IN ('auto', 'manual', 'hybrid'));
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS partial_credit_enabled BOOLEAN DEFAULT false;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_answers JSONB; -- for multiple correct answers
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS explanation_text TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS difficulty_level TEXT 
  CHECK (difficulty_level IN ('easy', 'medium', 'hard'));

-- Update question type constraint to include new types
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_question_type_check 
  CHECK (question_type IN (
    'mcq_single',      -- Multiple choice, single correct
    'mcq_multiple',    -- Multiple choice, multiple correct
    'true_false',      -- True/False
    'short_text',      -- Short typed answer
    'long_text',       -- Essay/paragraph
    'equation',        -- LaTeX mathematical equation
    'image_based',     -- Image/diagram question
    'multiple_choice', -- Legacy support
    'short_answer'     -- Legacy support
  ));

-- ========================================
-- 2. CREATE QUIZ_GRADING_RUBRICS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_grading_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  
  -- Keyword-based grading
  keywords JSONB, -- [{"keyword": "photosynthesis", "weight": 0.3}, ...]
  
  -- Regex patterns for advanced matching
  regex_patterns JSONB, -- [{"pattern": "^[0-9]+$", "description": "numeric answer"}]
  
  -- Partial credit rules
  partial_credit_rules JSONB, -- {"min_keywords": 2, "per_keyword": 5}
  
  -- Case sensitivity
  case_sensitive BOOLEAN DEFAULT false,
  
  -- Exact match requirement
  exact_match_required BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_grading_rubrics_question_id ON quiz_grading_rubrics(question_id);

-- ========================================
-- 3. CREATE QUIZ_QUESTION_IMAGES TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_question_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  
  image_url TEXT NOT NULL,
  image_type TEXT DEFAULT 'question' CHECK (image_type IN ('question', 'diagram', 'reference', 'answer')),
  
  -- Annotations for image markup
  annotations JSONB, -- [{"x": 100, "y": 200, "label": "Point A"}]
  
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_question_images_question_id ON quiz_question_images(question_id);

-- ========================================
-- 4. EXTEND QUIZ_ANSWERS TABLE
-- ========================================

-- Add grading transparency and notes
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS grading_notes TEXT; -- Internal teacher notes
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS keyword_matches JSONB; -- Matched keywords for transparency
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS partial_credit_breakdown JSONB; -- Detailed scoring
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2); -- For hybrid grading (0.00-1.00)
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ========================================
-- 5. CREATE QUIZ_ATTEMPT_FINALIZATION TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_attempt_finalization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  
  finalized_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  
  overall_remarks TEXT,
  grade_locked BOOLEAN DEFAULT true,
  
  -- Notification tracking
  student_notified BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempt_finalization_attempt_id ON quiz_attempt_finalization(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_finalization_finalized_by ON quiz_attempt_finalization(finalized_by);

-- ========================================
-- 6. CREATE QUIZ_GRADE_AUDIT TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_grade_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES quiz_answers(id) ON DELETE CASCADE,
  
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'finalized')),
  
  old_marks DECIMAL(10,2),
  new_marks DECIMAL(10,2),
  
  old_feedback TEXT,
  new_feedback TEXT,
  
  change_reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_grade_audit_answer_id ON quiz_grade_audit(answer_id);
CREATE INDEX IF NOT EXISTS idx_quiz_grade_audit_changed_by ON quiz_grade_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_quiz_grade_audit_changed_at ON quiz_grade_audit(changed_at DESC);

-- ========================================
-- 7. CREATE QUIZ_RETRY_SETTINGS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS quiz_retry_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL UNIQUE REFERENCES quizzes(id) ON DELETE CASCADE,
  
  allow_retry BOOLEAN DEFAULT false,
  max_attempts INTEGER DEFAULT 1,
  retry_delay_minutes INTEGER DEFAULT 0, -- Cooldown period between attempts
  
  -- Score display settings
  show_best_score BOOLEAN DEFAULT true,
  show_latest_score BOOLEAN DEFAULT true,
  show_all_attempts BOOLEAN DEFAULT false,
  
  -- Answer visibility settings
  show_correct_answers_after_attempt BOOLEAN DEFAULT false,
  show_correct_answers_after_all_attempts BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_retry_settings_quiz_id ON quiz_retry_settings(quiz_id);

-- ========================================
-- 8. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE quiz_grading_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempt_finalization ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_grade_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_retry_settings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 9. CREATE RLS POLICIES
-- ========================================

-- Quiz Grading Rubrics Policies
DROP POLICY IF EXISTS "Teachers can manage rubrics for their quizzes" ON quiz_grading_rubrics;
CREATE POLICY "Teachers can manage rubrics for their quizzes" ON quiz_grading_rubrics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quiz_questions
      JOIN quizzes ON quizzes.id = quiz_questions.quiz_id
      WHERE quiz_questions.id = quiz_grading_rubrics.question_id
      AND quizzes.created_by = auth.uid()
    )
  );

-- Quiz Question Images Policies
DROP POLICY IF EXISTS "Teachers can manage question images" ON quiz_question_images;
CREATE POLICY "Teachers can manage question images" ON quiz_question_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quiz_questions
      JOIN quizzes ON quizzes.id = quiz_questions.quiz_id
      WHERE quiz_questions.id = quiz_question_images.question_id
      AND quizzes.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view images of published quizzes" ON quiz_question_images;
CREATE POLICY "Students can view images of published quizzes" ON quiz_question_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_questions
      JOIN quizzes ON quizzes.id = quiz_questions.quiz_id
      WHERE quiz_questions.id = quiz_question_images.question_id
      AND quizzes.is_published = true
    )
  );

-- Quiz Attempt Finalization Policies
DROP POLICY IF EXISTS "Teachers can finalize their quiz attempts" ON quiz_attempt_finalization;
CREATE POLICY "Teachers can finalize their quiz attempts" ON quiz_attempt_finalization
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = quiz_attempt_finalization.attempt_id
      AND quizzes.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view their finalization status" ON quiz_attempt_finalization;
CREATE POLICY "Students can view their finalization status" ON quiz_attempt_finalization
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      WHERE quiz_attempts.id = quiz_attempt_finalization.attempt_id
      AND quiz_attempts.student_id = auth.uid()
    )
  );

-- Quiz Grade Audit Policies (Read-only for transparency)
DROP POLICY IF EXISTS "Teachers can view audit logs for their quizzes" ON quiz_grade_audit;
CREATE POLICY "Teachers can view audit logs for their quizzes" ON quiz_grade_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quiz_answers
      JOIN quiz_attempts ON quiz_attempts.id = quiz_answers.attempt_id
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_answers.id = quiz_grade_audit.answer_id
      AND quizzes.created_by = auth.uid()
    )
  );

-- Quiz Retry Settings Policies
DROP POLICY IF EXISTS "Teachers can manage retry settings" ON quiz_retry_settings;
CREATE POLICY "Teachers can manage retry settings" ON quiz_retry_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_retry_settings.quiz_id
      AND quizzes.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view retry settings for published quizzes" ON quiz_retry_settings;
CREATE POLICY "Students can view retry settings for published quizzes" ON quiz_retry_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_retry_settings.quiz_id
      AND quizzes.is_published = true
    )
  );

-- ========================================
-- 10. CREATE FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to create audit log entry on grade change
CREATE OR REPLACE FUNCTION log_grade_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND (OLD.marks_obtained != NEW.marks_obtained OR OLD.teacher_feedback != NEW.teacher_feedback)) THEN
    INSERT INTO quiz_grade_audit (
      answer_id,
      changed_by,
      change_type,
      old_marks,
      new_marks,
      old_feedback,
      new_feedback,
      change_reason
    ) VALUES (
      NEW.id,
      NEW.reviewed_by,
      'updated',
      OLD.marks_obtained,
      NEW.marks_obtained,
      OLD.teacher_feedback,
      NEW.teacher_feedback,
      'Grade modified'
    );
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO quiz_grade_audit (
      answer_id,
      changed_by,
      change_type,
      new_marks,
      new_feedback,
      change_reason
    ) VALUES (
      NEW.id,
      NEW.reviewed_by,
      'created',
      NEW.marks_obtained,
      NEW.teacher_feedback,
      'Initial grading'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for audit logging
DROP TRIGGER IF EXISTS quiz_answer_audit_trigger ON quiz_answers;
CREATE TRIGGER quiz_answer_audit_trigger
  AFTER INSERT OR UPDATE ON quiz_answers
  FOR EACH ROW
  EXECUTE FUNCTION log_grade_change();

-- Function to prevent modification of locked grades
CREATE OR REPLACE FUNCTION prevent_locked_grade_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM quiz_attempt_finalization
    WHERE attempt_id = (
      SELECT attempt_id FROM quiz_answers WHERE id = NEW.id
    )
    AND grade_locked = true
  ) THEN
    RAISE EXCEPTION 'Cannot modify grades for finalized attempts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce grade locking
DROP TRIGGER IF EXISTS prevent_locked_grade_modification_trigger ON quiz_answers;
CREATE TRIGGER prevent_locked_grade_modification_trigger
  BEFORE UPDATE ON quiz_answers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_grade_modification();

-- Function to update quiz_grading_rubrics timestamp
CREATE OR REPLACE FUNCTION update_rubric_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rubrics updated_at
DROP TRIGGER IF EXISTS rubric_updated_at_trigger ON quiz_grading_rubrics;
CREATE TRIGGER rubric_updated_at_trigger
  BEFORE UPDATE ON quiz_grading_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION update_rubric_timestamp();

-- ========================================
-- 11. ENABLE REALTIME FOR NEW TABLES
-- ========================================

DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE quiz_attempt_finalization;
  EXCEPTION 
    WHEN duplicate_object THEN
      RAISE NOTICE 'quiz_attempt_finalization already enabled for realtime';
    WHEN undefined_object THEN
      RAISE NOTICE 'supabase_realtime publication does not exist';
  END;
END $$;

-- ========================================
-- 12. ADD COMMENTS
-- ========================================

COMMENT ON TABLE quiz_grading_rubrics IS 'Stores grading criteria for automated and hybrid grading of text answers';
COMMENT ON TABLE quiz_question_images IS 'Stores images associated with questions for image-based questions';
COMMENT ON TABLE quiz_attempt_finalization IS 'Tracks finalization status and locks grades to prevent modification';
COMMENT ON TABLE quiz_grade_audit IS 'Audit trail for all grade changes for transparency and accountability';
COMMENT ON TABLE quiz_retry_settings IS 'Configures retry behavior and answer visibility for quizzes';

COMMENT ON COLUMN quiz_questions.grading_mode IS 'Determines how the question is graded: auto, manual, or hybrid';
COMMENT ON COLUMN quiz_questions.question_latex IS 'LaTeX equation for mathematical questions';
COMMENT ON COLUMN quiz_answers.confidence_score IS 'AI confidence score for hybrid grading (0.00-1.00)';
COMMENT ON COLUMN quiz_answers.keyword_matches IS 'Keywords matched during auto-grading for transparency';

-- ========================================
-- SETUP COMPLETE
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Enhanced quiz system schema created successfully!';
  RAISE NOTICE '📊 New tables: quiz_grading_rubrics, quiz_question_images, quiz_attempt_finalization, quiz_grade_audit, quiz_retry_settings';
  RAISE NOTICE '🔒 RLS policies enabled on all new tables';
  RAISE NOTICE '⚡ Triggers created for audit logging and grade locking';
  RAISE NOTICE '🔄 Realtime enabled for finalization notifications';
END $$;
