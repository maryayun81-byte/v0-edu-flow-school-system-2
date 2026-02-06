-- COMPREHENSIVE ASSIGNMENTS SYSTEM SCHEMA
-- Implements: Assignments, Questions, Submissions, Auto-grading support

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE assignment_type_enum AS ENUM ('ONLINE_AUTO_GRADED', 'OFFLINE_DOCUMENT_BASED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE assignment_status_enum AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_status_enum AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'MARKED', 'LATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id) NOT NULL,
    class_id UUID REFERENCES classes(id) NOT NULL,
    subject_id UUID REFERENCES subjects(id) NOT NULL,
    
    type assignment_type_enum NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- For Offline Assignments
    attachment_url TEXT,
    
    -- Grading & Deadlines
    total_marks INTEGER DEFAULT 0,
    due_date TIMESTAMPTZ NOT NULL,
    allow_late_submission BOOLEAN DEFAULT false,
    
    status assignment_status_enum DEFAULT 'DRAFT',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Assignment Questions Table (For Online)
CREATE TABLE IF NOT EXISTS assignment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- 'MCQ', 'SHORT_ANSWER', 'TRUE_FALSE', 'PARAGRAPH'
    marks INTEGER DEFAULT 1,
    
    -- Content
    image_url TEXT,
    options JSONB, -- For MCQ: [{label: "A", value: "Paris"}, ...]
    
    -- Grading Key (Security Logic applied in RLS/RPC)
    correct_answer TEXT, -- Simple text or JSON string for complex answers
    model_answer TEXT,   -- For AI/Manual grading reference
    
    order_index INTEGER DEFAULT 0
);

-- 4. Create Student Submissions Table
CREATE TABLE IF NOT EXISTS student_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id) NOT NULL,
    
    status submission_status_enum DEFAULT 'NOT_SUBMITTED',
    score INTEGER DEFAULT 0,
    
    submitted_at TIMESTAMPTZ,
    teacher_remarks TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(assignment_id, student_id)
);

-- 5. Create Submission Answers Table (Detail)
CREATE TABLE IF NOT EXISTS submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES student_submissions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES assignment_questions(id) ON DELETE CASCADE,
    
    student_answer TEXT, -- The answer provided by student
    
    is_correct BOOLEAN,
    score_awarded INTEGER DEFAULT 0,
    
    feedback TEXT, -- specific feedback for this question
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, question_id)
);

-- 6. Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- ASSIGNMENTS
-- Teachers can manage their own assignments
CREATE POLICY "Teachers can manage own assignments" 
ON assignments FOR ALL 
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

-- Students can view assignments for their class
CREATE POLICY "Students see assignments for their class" 
ON assignments FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_profiles 
        WHERE student_profiles.student_id = auth.uid() 
        AND student_profiles.class_id = assignments.class_id
    )
);

-- QUESTIONS
-- Teachers manage questions
CREATE POLICY "Teachers manage questions" 
ON assignment_questions FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
);

-- Students can view questions (BUT we will hide correct_answer in API selection)
CREATE POLICY "Students view questions" 
ON assignment_questions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        JOIN student_profiles ON student_profiles.class_id = assignments.class_id
        WHERE assignments.id = assignment_id 
        AND student_profiles.student_id = auth.uid()
        AND assignments.status IN ('PUBLISHED', 'CLOSED')
    )
);

-- SUBMISSIONS
-- Students manage their own submissions
CREATE POLICY "Students manage own submissions" 
ON student_submissions FOR ALL 
USING (student_id = auth.uid());

-- Teachers view submissions for their assignments
CREATE POLICY "Teachers view submissions" 
ON student_submissions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
);

-- Teachers can update submissions (grading)
CREATE POLICY "Teachers grade submissions" 
ON student_submissions FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
);


-- ANSWERS
CREATE POLICY "Students manage own answers" 
ON submission_answers FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        WHERE student_submissions.id = submission_id 
        AND student_submissions.student_id = auth.uid()
    )
);

CREATE POLICY "Teachers view answers" 
ON submission_answers FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_submissions 
        JOIN assignments ON assignments.id = student_submissions.assignment_id
        WHERE student_submissions.id = submission_id 
        AND assignments.teacher_id = auth.uid()
    )
);

-- 8. RPC Function for Secure Grading (To be implemented fully later)
-- This placeholder ensures we have the structure
CREATE OR REPLACE FUNCTION submit_online_assignment(
    p_submission_id UUID
) 
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
    -- Logic will go here to lock submission and calculate score
    UPDATE student_submissions 
    SET status = 'SUBMITTED', submitted_at = NOW()
    WHERE id = p_submission_id;
END;
$$;
