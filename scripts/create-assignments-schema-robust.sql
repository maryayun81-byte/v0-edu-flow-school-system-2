-- ROBUST ASSIGNMENTS SCHEMA (Fixes "column does not exist" error)
-- Checks for existing columns and adds them if missing.

-- 1. Create Enums (Idempotent)
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

-- 2. Create Table Structure (Idempotent)
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Columns Safely (Using ALTER TABLE)
DO $$ BEGIN
    -- teacher_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='teacher_id') THEN
        ALTER TABLE assignments ADD COLUMN teacher_id UUID REFERENCES profiles(id);
    END IF;

    -- class_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='class_id') THEN
        ALTER TABLE assignments ADD COLUMN class_id UUID REFERENCES classes(id);
    END IF;

    -- subject_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='subject_id') THEN
        ALTER TABLE assignments ADD COLUMN subject_id UUID REFERENCES subjects(id);
    END IF;

    -- type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='type') THEN
        ALTER TABLE assignments ADD COLUMN type assignment_type_enum DEFAULT 'ONLINE_AUTO_GRADED';
    END IF;

    -- title
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='title') THEN
        ALTER TABLE assignments ADD COLUMN title TEXT DEFAULT 'Untitled Assignment';
    END IF;

    -- description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='description') THEN
        ALTER TABLE assignments ADD COLUMN description TEXT;
    END IF;

    -- attachment_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='attachment_url') THEN
        ALTER TABLE assignments ADD COLUMN attachment_url TEXT;
    END IF;

    -- total_marks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='total_marks') THEN
        ALTER TABLE assignments ADD COLUMN total_marks INTEGER DEFAULT 0;
    END IF;

    -- due_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='due_date') THEN
        ALTER TABLE assignments ADD COLUMN due_date TIMESTAMPTZ;
    END IF;

    -- allow_late_submission
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='allow_late_submission') THEN
        ALTER TABLE assignments ADD COLUMN allow_late_submission BOOLEAN DEFAULT false;
    END IF;

    -- status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignments' AND column_name='status') THEN
        ALTER TABLE assignments ADD COLUMN status assignment_status_enum DEFAULT 'DRAFT';
    END IF;
END $$;


-- 4. Dependent Tables (Questions, Submissions) - Idempotent
-- We use standard CREATE TABLE IF NOT EXISTS here as these are less likely to conflict partially
CREATE TABLE IF NOT EXISTS assignment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    question_text TEXT, 
    question_type TEXT, 
    marks INTEGER DEFAULT 1,
    image_url TEXT,
    options JSONB, 
    correct_answer TEXT, 
    model_answer TEXT,   
    order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id),
    status submission_status_enum DEFAULT 'NOT_SUBMITTED',
    score INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    teacher_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES student_submissions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES assignment_questions(id) ON DELETE CASCADE,
    student_answer TEXT, 
    is_correct BOOLEAN,
    score_awarded INTEGER DEFAULT 0,
    feedback TEXT, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, question_id)
);

-- 5. Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- 6. Re-apply Policies (Drop first to avoid conflicts)
DROP POLICY IF EXISTS "Teachers can manage own assignments" ON assignments;
DROP POLICY IF EXISTS "Students see assignments for their class" ON assignments;

CREATE POLICY "Teachers can manage own assignments" 
ON assignments FOR ALL 
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Students see assignments for their class" 
ON assignments FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN classes c ON p.form_class = c.name
        WHERE p.id = auth.uid() 
        AND c.id = assignments.class_id
        AND p.role = 'student'
    )
);

-- (Policies for other tables omitted for brevity, adding essential ones)
DROP POLICY IF EXISTS "Teachers manage questions" ON assignment_questions;
CREATE POLICY "Teachers manage questions" 
ON assignment_questions FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_id 
        AND assignments.teacher_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Students manage own submissions" ON student_submissions;
CREATE POLICY "Students manage own submissions" 
ON student_submissions FOR ALL 
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students view questions" ON assignment_questions;
CREATE POLICY "Students view questions" 
ON assignment_questions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        JOIN classes c ON c.id = assignments.class_id
        JOIN profiles p ON p.form_class = c.name
        WHERE assignments.id = assignment_id 
        AND p.id = auth.uid()
        AND p.role = 'student'
        AND assignments.status IN ('PUBLISHED', 'CLOSED')
    )
);


-- 7. RPC Function
CREATE OR REPLACE FUNCTION submit_online_assignment(
    p_submission_id UUID
) 
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
    UPDATE student_submissions 
    SET status = 'SUBMITTED', submitted_at = NOW()
    WHERE id = p_submission_id;
END;
$$;
