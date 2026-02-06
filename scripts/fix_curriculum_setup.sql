-- =============================================
-- COMPLETE CURRICULUM SETUP FIX (CBC & 8-4-4)
-- =============================================

-- DROP CONFLICTING FUNCTIONS FIRST
-- This resolves the "return type mismatch" error
DROP FUNCTION IF EXISTS get_class_transcripts(uuid, uuid);
DROP FUNCTION IF EXISTS get_grade_for_score_by_system(numeric, uuid, uuid);
DROP FUNCTION IF EXISTS get_student_transcript_format(uuid);


-- 1. PROFILES UPDATE (Student Curriculum)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS curriculum_type text DEFAULT '8-4-4' CHECK (curriculum_type IN ('CBC', '8-4-4'));

-- 2. GRADING SYSTEMS UPDATE
ALTER TABLE grading_systems 
ADD COLUMN IF NOT EXISTS system_type text DEFAULT '8-4-4' CHECK (system_type IN ('CBC', '8-4-4'));

-- Ensure existing systems are labeled
UPDATE grading_systems SET system_type = '8-4-4' WHERE system_type IS NULL;

-- 3. UNIQUE ACTIVE SYSTEM CONSTRAINT
DROP INDEX IF EXISTS one_active_system_idx;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_cbc_idx ON grading_systems (is_active) WHERE is_active = true AND system_type = 'CBC';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_844_idx ON grading_systems (is_active) WHERE is_active = true AND system_type = '8-4-4';

-- 4. SEED CBC SYSTEM
DO $$
DECLARE
    v_sys_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM grading_systems WHERE system_type = 'CBC' AND name = 'CBC Standard') THEN
        INSERT INTO grading_systems (name, is_active, system_type) 
        VALUES ('CBC Standard', true, 'CBC') 
        RETURNING id INTO v_sys_id;

        INSERT INTO grading_scales (grading_system_id, grade_label, min_percentage, max_percentage, grade_points, remarks) VALUES
        (v_sys_id, 'EE', 80, 100, 4, 'Exceeding Expectations'),
        (v_sys_id, 'ME', 60, 79,  3, 'Meeting Expectations'),
        (v_sys_id, 'AE', 40, 59,  2, 'Approaching Expectations'),
        (v_sys_id, 'BE', 0,  39,  1, 'Below Expectations');
    END IF;
END $$;

-- 5. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type text NOT NULL, -- 'UPDATE_CURRICULUM', 'UPDATE_GRADING_CONFIG', 'GENERATE_TRANSCRIPT'
    table_name text,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    admin_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- RLS for Audit Logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid errors
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_logs;

CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Admins can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- 6. TRANSCRIPT FORMAT HELPER
CREATE OR REPLACE FUNCTION get_student_transcript_format(p_student_id uuid)
RETURNS text AS $$
DECLARE
    v_type text;
BEGIN
    SELECT curriculum_type INTO v_type FROM profiles WHERE id = p_student_id;
    RETURN COALESCE(v_type, '8-4-4');
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. UPDATED GRADING FUNCTION (System Aware)
CREATE OR REPLACE FUNCTION get_grade_for_score_by_system(
    p_score numeric,
    p_system_id uuid,
    p_subject_id uuid DEFAULT NULL
)
RETURNS TABLE (
    grade text,
    points integer,
    remarks text
) AS $$
DECLARE
    v_override_record record;
    v_scale_record record;
BEGIN
    -- Check for Subject Override
    IF p_subject_id IS NOT NULL THEN
        SELECT grade_label, grade_points, remarks 
        INTO v_override_record
        FROM subject_grading_overrides
        WHERE grading_system_id = p_system_id
          AND subject_id = p_subject_id
          AND p_score BETWEEN min_percentage AND max_percentage
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT v_override_record.grade_label, v_override_record.grade_points, v_override_record.remarks;
            RETURN;
        END IF;
    END IF;

    -- Check Standard Scale
    SELECT grade_label, grade_points, remarks
    INTO v_scale_record
    FROM grading_scales
    WHERE grading_system_id = p_system_id
      AND p_score BETWEEN min_percentage AND max_percentage
    ORDER BY min_percentage DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_scale_record.grade_label, v_scale_record.grade_points, v_scale_record.remarks;
    ELSE
        RETURN QUERY SELECT 'E'::text, 0, 'No Grade'::text; 
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. GET CLASS TRANSCRIPTS RPC
CREATE OR REPLACE FUNCTION get_class_transcripts(p_exam_id uuid, p_class_id uuid)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  student_name text,
  admission_number text,
  class_name text,
  curriculum_type text,
  total_score numeric,
  average_score numeric,
  overall_grade text,
  class_position integer,
  admin_remarks text,
  status text,
  published_at timestamptz,
  items jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.student_id,
    p.full_name as student_name,
    p.admission_number,
    p.form_class as class_name,
    COALESCE(p.curriculum_type, '8-4-4') as curriculum_type,
    t.total_score,
    t.average_score,
    t.overall_grade,
    t.class_position,
    t.admin_remarks,
    t.status,
    t.published_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'subject_id', ti.subject_id,
          'subject_name', ti.subject_name,
          'score', ti.score,
          'max_score', ti.max_score,
          'grade', ti.grade,
          'teacher_remarks', ti.teacher_remarks
        ) ORDER BY ti.subject_name)
        FROM transcript_items ti
        WHERE ti.transcript_id = t.id
      ),
      '[]'::jsonb
    ) as items
  FROM transcripts t
  JOIN profiles p ON t.student_id = p.id
  WHERE t.exam_id = p_exam_id AND t.class_id = p_class_id;
END;
$$ LANGUAGE plpgsql;
