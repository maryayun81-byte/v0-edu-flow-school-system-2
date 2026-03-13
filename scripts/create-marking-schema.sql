-- ============================================================
-- ENTERPRISE MARKING SYSTEM: SCHEMA OVERHAUL
-- ============================================================

-- 1. Drop old table if it exists to ensure new structured schema is applied
DROP TABLE IF EXISTS submission_annotations;

CREATE TABLE submission_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES student_submissions(id) ON DELETE CASCADE,
    page_number INTEGER DEFAULT 1,
    tool_type TEXT NOT NULL, -- 'tick', 'cross', 'highlight', 'circle', 'underline', 'freehand', 'comment', 'text'
    x_position FLOAT NOT NULL,
    y_position FLOAT NOT NULL,
    width FLOAT,
    height FLOAT,
    color TEXT DEFAULT '#ef4444',
    stroke_width INTEGER DEFAULT 3,
    text_content TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add score and metadata to student_submissions for instant visibility
ALTER TABLE student_submissions 
ADD COLUMN IF NOT EXISTS score FLOAT,
ADD COLUMN IF NOT EXISTS max_score FLOAT,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS marked_file_url TEXT;

-- 3. Indices for performance
CREATE INDEX IF NOT EXISTS idx_annotations_submission_id ON submission_annotations(submission_id);
CREATE INDEX IF NOT EXISTS idx_annotations_page_number ON submission_annotations(page_number);

-- 4. Enable RLS on annotations
ALTER TABLE submission_annotations ENABLE ROW LEVEL SECURITY;

-- 5. Policies for annotations
-- Teachers can manage annotations for assignments they own
CREATE POLICY "Teachers can manage annotations" ON submission_annotations
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM student_submissions ss
        JOIN assignments a ON a.id = ss.assignment_id
        WHERE ss.id = submission_annotations.submission_id
        AND a.teacher_id = auth.uid()
    )
);

-- Students can view annotations once the assignment is returned
CREATE POLICY "Students can view annotations" ON submission_annotations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM student_submissions ss
        WHERE ss.id = submission_annotations.submission_id
        AND ss.student_id = auth.uid()
        AND ss.status IN ('RETURNED', 'MARKED')
    )
);
