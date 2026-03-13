-- ============================================================
-- ENTERPRISE ASSIGNMENT SYSTEM V2 - SCHEMA MIGRATION
-- ============================================================

-- 1. Extend Assignments Table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS questions_json JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS worksheet_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1;

-- 2. Assignment Pages (Multi-page support)
CREATE TABLE IF NOT EXISTS assignment_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    page_content JSONB DEFAULT '{}', -- Store rich text content, layout, etc.
    header_title TEXT,
    footer_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(assignment_id, page_number)
);

-- 3. Assignment Questions (Detailed Question Storage)
CREATE TABLE IF NOT EXISTS assignment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    page_id UUID REFERENCES assignment_pages(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'text', -- text, number, multiple_choice, checkbox, image, drawing, equation, table
    marks NUMERIC NOT NULL DEFAULT 1,
    hint TEXT,
    answer_box_config JSONB DEFAULT '{}', -- Position (x, y), size, placeholder
    options JSONB DEFAULT '[]', -- For multiple choice/checkbox
    order_index INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Student Submissions (Enhanced)
ALTER TABLE student_submissions 
ADD COLUMN IF NOT EXISTS worksheet_answers JSONB DEFAULT '{}', -- Store {question_id: answer}
ADD COLUMN IF NOT EXISTS submission_mode TEXT DEFAULT 'ONLINE', -- ONLINE, PHOTO, BOTH
ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT true;

-- 5. Question-Level Answers (For granular tracking and analytics)
CREATE TABLE IF NOT EXISTS student_question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES student_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_json JSONB,
    uploaded_file_url TEXT,
    is_answered BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(submission_id, question_id)
);

-- 6. Question-Level Marking & Annotations
CREATE TABLE IF NOT EXISTS question_markings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES student_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
    marks_awarded NUMERIC DEFAULT 0,
    teacher_comment TEXT,
    annotation_data JSONB DEFAULT '[]', -- Fabric.js objects for this specific question
    is_annotated BOOLEAN DEFAULT false,
    marked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(submission_id, question_id)
);

-- 7. Assignment Analytics (Aggregated Data)
CREATE TABLE IF NOT EXISTS assignment_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    total_submissions INTEGER DEFAULT 0,
    average_score NUMERIC DEFAULT 0,
    highest_score NUMERIC DEFAULT 0,
    lowest_score NUMERIC DEFAULT 0,
    common_mistakes JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(assignment_id)
);

-- 8. Enable RLS
ALTER TABLE assignment_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_markings ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_analytics ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies

-- Pages & Questions: Visible to students assigned and teachers
CREATE POLICY "Viewable by assigned students and teachers" ON assignment_pages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND (a.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM assignment_recipients ar WHERE ar.assignment_id = a.id AND ar.student_id = auth.uid())))
);

CREATE POLICY "Viewable by assigned students and teachers" ON assignment_questions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND (a.teacher_id = auth.uid() OR EXISTS (SELECT 1 FROM assignment_recipients ar WHERE ar.assignment_id = a.id AND ar.student_id = auth.uid())))
);

-- Student Answers: Manageable by student, viewable by teacher
CREATE POLICY "Students can manage their own answers" ON student_question_answers
FOR ALL USING (
    EXISTS (SELECT 1 FROM student_submissions ss WHERE ss.id = submission_id AND ss.student_id = auth.uid())
);

CREATE POLICY "Teachers can view student answers" ON student_question_answers
FOR SELECT USING (
    EXISTS (SELECT 1 FROM student_submissions ss JOIN assignments a ON a.id = ss.assignment_id WHERE ss.id = submission_id AND a.teacher_id = auth.uid())
);

-- Markings: Viewable by student (when returned), manageable by teacher
CREATE POLICY "Teachers can manage markings" ON question_markings
FOR ALL USING (
    EXISTS (SELECT 1 FROM student_submissions ss JOIN assignments a ON a.id = ss.assignment_id WHERE ss.id = submission_id AND a.teacher_id = auth.uid())
);

CREATE POLICY "Students can view markings when returned" ON question_markings
FOR SELECT USING (
    EXISTS (SELECT 1 FROM student_submissions ss WHERE ss.id = submission_id AND ss.student_id = auth.uid() AND ss.status IN ('RETURNED', 'MARKED'))
);

-- 10. Indices
CREATE INDEX IF NOT EXISTS idx_assignment_pages_assignment ON assignment_pages(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment ON assignment_questions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_question_answers_submission ON student_question_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_question_markings_submission ON question_markings(submission_id);
