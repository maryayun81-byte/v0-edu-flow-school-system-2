-- Fix get_class_transcripts to return [] instead of NULL for items
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
    COALESCE(
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
      ),
      '[]'::jsonb
    ) as items
  FROM transcripts t
  JOIN profiles p ON p.id = t.student_id
  WHERE t.exam_id = p_exam_id
  AND t.class_id = p_class_id
  ORDER BY t.average_score DESC;
END;
$$;
