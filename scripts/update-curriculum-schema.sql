-- =============================================
-- Upgrade Schema: Dual Curriculum (CBC & 8-4-4)
-- =============================================

-- 1. ADD CURRICULUM TYPE TO PROFILES
-- Default to 8-4-4 for existing students during migration
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS curriculum_type text DEFAULT '8-4-4' CHECK (curriculum_type IN ('CBC', '8-4-4'));

-- 2. ADD SYSTEM TYPE TO GRADING SYSTEMS
-- "KCSE Standard" (existing) will be '8-4-4'
ALTER TABLE grading_systems 
ADD COLUMN IF NOT EXISTS system_type text DEFAULT '8-4-4' CHECK (system_type IN ('CBC', '8-4-4'));

-- Update existing systems to be 8-4-4
UPDATE grading_systems SET system_type = '8-4-4' WHERE system_type IS NULL;

-- 3. ENSURE ONE ACTIVE SYSTEM PER TYPE
-- Drop old unique index if exists (which enforced only ONE active system globally)
DROP INDEX IF EXISTS one_active_system_idx;

-- Create new partial unique indexes: One active CBC, One active 8-4-4
CREATE UNIQUE INDEX IF NOT EXISTS one_active_cbc_idx 
ON grading_systems (is_active) 
WHERE is_active = true AND system_type = 'CBC';

CREATE UNIQUE INDEX IF NOT EXISTS one_active_844_idx 
ON grading_systems (is_active) 
WHERE is_active = true AND system_type = '8-4-4';

-- 4. SEED CBC GRADING SYSTEM
DO $$
DECLARE
    v_sys_id uuid;
BEGIN
    -- Check if CBC system already exists
    IF NOT EXISTS (SELECT 1 FROM grading_systems WHERE system_type = 'CBC' AND name = 'CBC Standard') THEN
        
        INSERT INTO grading_systems (name, is_active, system_type) 
        VALUES ('CBC Standard', true, 'CBC') 
        RETURNING id INTO v_sys_id;

        -- Insert CBC Scales (Performance Levels)
        -- Using strict generic percentage ranges roughly mapping to standard interpretation
        -- Admin can adjust these later
        INSERT INTO grading_scales (grading_system_id, grade_label, min_percentage, max_percentage, grade_points, remarks) VALUES
        (v_sys_id, 'EE', 80, 100, 4, 'Exceeding Expectations'),
        (v_sys_id, 'ME', 60, 79,  3, 'Meeting Expectations'),
        (v_sys_id, 'AE', 40, 59,  2, 'Approaching Expectations'),
        (v_sys_id, 'BE', 0,  39,  1, 'Below Expectations');
        
    END IF;
END $$;


-- 5. UPDATE GRADING FUNCTION
-- Now accepts p_system_id explicitely OR finds active system based on input (e.g. system_type)
-- But for simplicity, we will keep get_grade_for_score flexible.
-- Overloading it to take system_id is safest.

DROP FUNCTION IF EXISTS get_grade_for_score_by_system;

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
    -- 1. Check for Subject Override in this specific system
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

    -- 2. Check Standard Scale for this system
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


-- Helper to get active system ID for a curriculum type
CREATE OR REPLACE FUNCTION get_active_system_id_for_type(p_type text)
RETURNS uuid AS $$
    SELECT id FROM grading_systems 
    WHERE system_type = p_type AND is_active = true 
    LIMIT 1;
$$ LANGUAGE sql STABLE;

