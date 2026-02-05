-- ========================================
-- EXAM-AWARE ACADEMIC RESULTS SYSTEM
-- Complete Database Schema
-- ========================================
-- This script creates all tables, functions, triggers, and policies
-- for a comprehensive exam-aware academic results system
-- ========================================

-- ========================================
-- PART 1: CORE TABLES
-- ========================================

-- 1. EXAMS TABLE (Single Source of Truth)
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name TEXT NOT NULL,
  academic_year INTEGER NOT NULL,
  term TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Closed', 'Finalized')),
  applicable_classes UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_year CHECK (academic_year >= 2020 AND academic_year <= 2100)
);

-- 2. MARKS TABLE (Hard Enforcement of Exam Reference)
CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  grade TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_score CHECK (score >= 0 AND score <= max_score),
  CONSTRAINT valid_max_score CHECK (max_score > 0),
  CONSTRAINT unique_mark_entry UNIQUE (exam_id, student_id, subject_id),
  
  -- NO MARKS WITHOUT EXAM_ID - This is enforced by NOT NULL constraint above
  -- This prevents any orphaned marks or historical contamination
  CONSTRAINT exam_must_exist CHECK (exam_id IS NOT NULL)
);

-- 3. TRANSCRIPTS TABLE (Official Academic Documents)
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  total_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  average_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall_grade TEXT,
  class_position INTEGER,
  admin_remarks TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Published')),
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_transcript UNIQUE (exam_id, student_id),
  CONSTRAINT valid_average CHECK (average_score >= 0 AND average_score <= 100)
);

-- 4. TRANSCRIPT ITEMS TABLE (Individual Subject Results)
CREATE TABLE IF NOT EXISTS transcript_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL,
  grade TEXT,
  teacher_remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_transcript_subject UNIQUE (transcript_id, subject_id)
);

-- 5. EXAM AUDIT LOG TABLE (Complete Audit Trail)
CREATE TABLE IF NOT EXISTS exam_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'exam_created', 'exam_activated', 'exam_closed', 'exam_finalized',
    'marks_submitted', 'marks_updated', 'marks_deleted',
    'transcript_generated', 'transcript_published', 'transcript_updated'
  )),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_role TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- PART 2: INDEXES FOR PERFORMANCE
-- ========================================

-- Exams indexes
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_academic_year ON exams(academic_year);
CREATE INDEX IF NOT EXISTS idx_exams_term ON exams(term);
CREATE INDEX IF NOT EXISTS idx_exams_dates ON exams(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);

-- Marks indexes
CREATE INDEX IF NOT EXISTS idx_marks_exam_id ON marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_class_id ON marks(class_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject_id ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_teacher_id ON marks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam_student ON marks(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam_class ON marks(exam_id, class_id);

-- Transcripts indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_exam_id ON transcripts(exam_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_student_id ON transcripts(student_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(status);
CREATE INDEX IF NOT EXISTS idx_transcripts_exam_student ON transcripts(exam_id, student_id);

-- Transcript items indexes
CREATE INDEX IF NOT EXISTS idx_transcript_items_transcript_id ON transcript_items(transcript_id);
CREATE INDEX IF NOT EXISTS idx_transcript_items_subject_id ON transcript_items(subject_id);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_exam_id ON exam_audit_log(exam_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON exam_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON exam_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON exam_audit_log(created_at DESC);

-- ========================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage exams" ON exams;
DROP POLICY IF EXISTS "Teachers can view active/closed exams" ON exams;
DROP POLICY IF EXISTS "Students can view active exams" ON exams;

DROP POLICY IF EXISTS "Teachers can manage marks for their subjects" ON marks;
DROP POLICY IF EXISTS "Admins can view all marks" ON marks;
DROP POLICY IF EXISTS "Students can view their own marks" ON marks;

DROP POLICY IF EXISTS "Admins can manage transcripts" ON transcripts;
DROP POLICY IF EXISTS "Students can view their published transcripts" ON transcripts;

DROP POLICY IF EXISTS "Users can view transcript items for their transcripts" ON transcript_items;

DROP POLICY IF EXISTS "Admins can view audit log" ON exam_audit_log;

-- ========================================
-- EXAMS POLICIES
-- ========================================

-- Admins can do everything with exams
CREATE POLICY "Admins can manage exams"
  ON exams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Teachers can view Active and Closed exams (to see what's available and enter marks)
CREATE POLICY "Teachers can view active/closed exams"
  ON exams
  FOR SELECT
  USING (
    status IN ('Active', 'Closed', 'Finalized')
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
    )
  );

-- Students can view Active exams (informational only)
CREATE POLICY "Students can view active exams"
  ON exams
  FOR SELECT
  USING (
    status IN ('Active', 'Finalized')
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'student'
    )
  );

-- ========================================
-- MARKS POLICIES
-- ========================================

-- Teachers can insert/update marks for exams they're assigned to (only when exam is Closed)
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
      AND marks.subject_id = ANY(ARRAY(SELECT jsonb_array_elements_text(tc.subjects))::uuid[])
      AND EXISTS (
        SELECT 1 FROM exams 
        WHERE exams.id = marks.exam_id 
        AND exams.status IN ('Closed', 'Finalized')
      )
    )
  );

-- Admins can view all marks
CREATE POLICY "Admins can view all marks"
  ON marks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Students can view their own marks (only for finalized exams)
CREATE POLICY "Students can view their own marks"
  ON marks
  FOR SELECT
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM exams 
      WHERE exams.id = marks.exam_id 
      AND exams.status = 'Finalized'
    )
  );

-- ========================================
-- TRANSCRIPTS POLICIES
-- ========================================

-- Admins can manage all transcripts
CREATE POLICY "Admins can manage transcripts"
  ON transcripts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Students can view their own published transcripts
CREATE POLICY "Students can view their published transcripts"
  ON transcripts
  FOR SELECT
  USING (
    student_id = auth.uid()
    AND status = 'Published'
  );

-- ========================================
-- TRANSCRIPT ITEMS POLICIES
-- ========================================

-- Users can view transcript items if they can view the transcript
CREATE POLICY "Users can view transcript items for their transcripts"
  ON transcript_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transcripts 
      WHERE transcripts.id = transcript_items.transcript_id
      AND (
        -- Student viewing their own
        (transcripts.student_id = auth.uid() AND transcripts.status = 'Published')
        OR
        -- Admin viewing any
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- ========================================
-- AUDIT LOG POLICIES
-- ========================================

-- Only admins can view audit log
CREATE POLICY "Admins can view audit log"
  ON exam_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ========================================
-- PART 4: FUNCTIONS & TRIGGERS
-- ========================================

-- Function to automatically close exams when end_date passes
CREATE OR REPLACE FUNCTION check_and_close_exams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE exams
  SET status = 'Closed',
      updated_at = NOW()
  WHERE status = 'Active'
  AND end_date < CURRENT_DATE;
END;
$$;

-- Function to calculate grade from score
CREATE OR REPLACE FUNCTION calculate_grade(score NUMERIC, max_score NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  percentage NUMERIC;
BEGIN
  IF max_score = 0 THEN
    RETURN 'N/A';
  END IF;
  
  percentage := (score / max_score) * 100;
  
  CASE
    WHEN percentage >= 90 THEN RETURN 'A';
    WHEN percentage >= 80 THEN RETURN 'A-';
    WHEN percentage >= 75 THEN RETURN 'B+';
    WHEN percentage >= 70 THEN RETURN 'B';
    WHEN percentage >= 65 THEN RETURN 'B-';
    WHEN percentage >= 60 THEN RETURN 'C+';
    WHEN percentage >= 55 THEN RETURN 'C';
    WHEN percentage >= 50 THEN RETURN 'C-';
    WHEN percentage >= 45 THEN RETURN 'D+';
    WHEN percentage >= 40 THEN RETURN 'D';
    WHEN percentage >= 35 THEN RETURN 'D-';
    ELSE RETURN 'E';
  END CASE;
END;
$$;

-- Trigger to auto-calculate grade when mark is inserted/updated
CREATE OR REPLACE FUNCTION auto_calculate_grade()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.grade := calculate_grade(NEW.score, NEW.max_score);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_calculate_grade ON marks;
CREATE TRIGGER trigger_auto_calculate_grade
  BEFORE INSERT OR UPDATE ON marks
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_grade();

-- Function to prevent editing finalized exams
CREATE OR REPLACE FUNCTION prevent_finalized_exam_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM exams 
    WHERE id = NEW.exam_id 
    AND status = 'Finalized'
  ) THEN
    RAISE EXCEPTION 'Cannot modify marks for a finalized exam';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_finalized_edits ON marks;
CREATE TRIGGER trigger_prevent_finalized_edits
  BEFORE INSERT OR UPDATE ON marks
  FOR EACH ROW
  EXECUTE FUNCTION prevent_finalized_exam_edits();

-- Function to get missing marks for an exam
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
  LEFT JOIN teacher_classes tc ON tc.class_id = c.id AND s.id = ANY(ARRAY(SELECT jsonb_array_elements_text(tc.subjects))::uuid[])
  LEFT JOIN profiles p ON p.id = tc.teacher_id
  LEFT JOIN marks m ON m.exam_id = p_exam_id AND m.class_id = c.id AND m.subject_id = s.id
  WHERE c.id = ANY((SELECT applicable_classes FROM exams WHERE id = p_exam_id))
  GROUP BY c.id, c.name, s.id, s.name, tc.teacher_id, p.full_name
  HAVING COUNT(DISTINCT m.student_id) < (SELECT COUNT(*) FROM student_classes WHERE class_id = c.id);
END;
$$;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_exam_audit(
  p_exam_id UUID,
  p_action_type TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  -- Insert audit log
  INSERT INTO exam_audit_log (
    exam_id,
    action_type,
    performed_by,
    performed_by_role,
    details
  ) VALUES (
    p_exam_id,
    p_action_type,
    auth.uid(),
    v_user_role,
    p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ========================================
-- PART 5: HELPER FUNCTIONS
-- ========================================

-- Function to check if all marks are complete for an exam/class
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
  
  -- Get total subjects for this class (from teacher_classes)
  SELECT COUNT(DISTINCT unnest(ARRAY(SELECT jsonb_array_elements_text(subjects))::uuid[])) INTO v_total_subjects
  FROM teacher_classes
  WHERE class_id = p_class_id;
  
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

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Uncomment to verify schema after running this script:

-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('exams', 'marks', 'transcripts', 'transcript_items', 'exam_audit_log');

-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('exams', 'marks', 'transcripts', 'transcript_items', 'exam_audit_log');
