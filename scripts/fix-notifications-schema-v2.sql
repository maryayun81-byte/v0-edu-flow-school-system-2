-- ========================================
-- FIX NOTIFICATIONS & TRANSCRIPTS RLS (V2)
-- ========================================

-- 1. SCHEMA FIX: Add 'target_role' if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_role') THEN
        ALTER TABLE notifications ADD COLUMN target_role TEXT;
    END IF;
END $$;

-- 2. NOTIFICATIONS RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;

-- Policy for users to view ONLY their own notifications or broadcast notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (
    -- Direct targeting
    target_user_id = auth.uid()
    OR
    -- Role-based broadcast (if target_user_id is NULL)
    (target_user_id IS NULL AND target_role = (SELECT role FROM profiles WHERE id = auth.uid()))
  );

-- Admins can do everything
CREATE POLICY "Admins can manage notifications"
  ON notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 3. TRANSCRIPTS RLS (Enhance existing)
-- Ensure 'Published' transcripts are visible to students
DROP POLICY IF EXISTS "Students can view their published transcripts" ON transcripts;
CREATE POLICY "Students can view their published transcripts"
  ON transcripts
  FOR SELECT
  USING (
    student_id = auth.uid()
    AND status = 'Published'
  );

-- Ensure Transcript Items are visible if Transcript is visible
DROP POLICY IF EXISTS "Users can view transcript items for their transcripts" ON transcript_items;
CREATE POLICY "Users can view transcript items for their transcripts"
  ON transcript_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transcripts 
      WHERE transcripts.id = transcript_items.transcript_id
      AND (
        -- Standard RLS on transcripts table will handle the check
        -- But for performance/explicitness:
        (transcripts.student_id = auth.uid() AND transcripts.status = 'Published')
        OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- 4. HELPER: Fetch Existing Transcripts Function
-- Efficiently fetch transcripts with items for Admin View
DROP FUNCTION IF EXISTS get_class_transcripts(UUID, UUID);
CREATE OR REPLACE FUNCTION get_class_transcripts(p_exam_id UUID, p_class_id UUID)
RETURNS TABLE (
  id UUID,
  student_id UUID,
  student_name TEXT,
  admission_number TEXT,
  total_score NUMERIC,
  average_score NUMERIC,
  overall_grade TEXT,
  class_position INTEGER,
  admin_remarks TEXT,
  status TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.student_id,
    p.full_name as student_name,
    p.admission_number,
    t.total_score,
    t.average_score,
    t.overall_grade,
    t.class_position,
    t.admin_remarks,
    t.status,
    t.published_at,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'subject_id', ti.subject_id,
          'subject_name', ti.subject_name,
          'score', ti.score,
          'max_score', ti.max_score,
          'grade', ti.grade,
          'teacher_remarks', ti.teacher_remarks
        )
      )
      FROM transcript_items ti
      WHERE ti.transcript_id = t.id
    ) as items
  FROM transcripts t
  JOIN profiles p ON p.id = t.student_id
  WHERE t.exam_id = p_exam_id
  AND t.class_id = p_class_id
  ORDER BY t.average_score DESC;
END;
$$;
