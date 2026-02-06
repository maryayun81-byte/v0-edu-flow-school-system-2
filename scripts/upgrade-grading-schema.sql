-- =============================================
-- Upgrade Schema: Robust Grading & School Identity
-- =============================================

-- 1. SCHOOL PROFILE UPDATES
-- Add new contact/branding fields to existing settings table
ALTER TABLE school_settings 
ADD COLUMN IF NOT EXISTS motto text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS email text;

-- 2. GRADING SYSTEMS
CREATE TABLE IF NOT EXISTS grading_systems (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Ensure only one system is active
CREATE UNIQUE INDEX IF NOT EXISTS one_active_system_idx ON grading_systems (is_active) WHERE is_active = true;

-- 3. GRADING SCALES (The actual grades: A, A-, B+...)
CREATE TABLE IF NOT EXISTS grading_scales (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    grading_system_id uuid REFERENCES grading_systems(id) ON DELETE CASCADE,
    grade_label text NOT NULL, -- A, B+, etc.
    min_percentage integer NOT NULL,
    max_percentage integer NOT NULL,
    grade_points integer, -- 12, 11, 10...
    remarks text, -- Excellent, Good...
    created_at timestamptz DEFAULT now()
);

-- 4. SUBJECT OVERRIDES
CREATE TABLE IF NOT EXISTS subject_grading_overrides (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    grading_system_id uuid REFERENCES grading_systems(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
    grade_label text NOT NULL, -- E.g. "A". We store label to map back to a scale concept, or just define ranges directly. 
    -- Actually, simpler: define the range for this grade label for this subject
    min_percentage integer NOT NULL,
    max_percentage integer NOT NULL,
    grade_points integer,
    remarks text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(grading_system_id, subject_id, grade_label)
);

-- 5. SIGNATURES
CREATE TABLE IF NOT EXISTS signatures (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    role text NOT NULL, -- 'Principal', 'Registrar', 'class_teacher'
    signature_type text check (signature_type in ('typed', 'drawn', 'image', 'upload')),
    signature_url text, -- For images
    signature_data text, -- For base64 or other data
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- RLS POLICIES

-- School Settings: public read, admin update
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON school_settings FOR SELECT USING (true);
CREATE POLICY "Admin update settings" ON school_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Grading Systems: public read, admin all
ALTER TABLE grading_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read grading systems" ON grading_systems FOR SELECT USING (true);
CREATE POLICY "Admin manage grading systems" ON grading_systems FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Grading Scales: public read, admin all
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read grading scales" ON grading_scales FOR SELECT USING (true);
CREATE POLICY "Admin manage grading scales" ON grading_scales FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Overrides: public read, admin all
ALTER TABLE subject_grading_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read overrides" ON subject_grading_overrides FOR SELECT USING (true);
CREATE POLICY "Admin manage overrides" ON subject_grading_overrides FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Signatures: authenticated read (so teachers/students see it on transcript), admin all
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read signatures" ON signatures FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage signatures" ON signatures FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- FUNCTION: Calculate Grade
-- Drops existing if signature changed
DROP FUNCTION IF EXISTS get_grade_for_score;

CREATE OR REPLACE FUNCTION get_grade_for_score(
    p_score numeric,
    p_subject_id uuid DEFAULT NULL 
)
RETURNS TABLE (
    grade text,
    points integer,
    remarks text
) AS $$
DECLARE
    v_system_id uuid;
    v_override_record record;
    v_scale_record record;
BEGIN
    -- 1. Get active system
    SELECT id INTO v_system_id FROM grading_systems WHERE is_active = true LIMIT 1;
    
    -- If no active system, fallback to legacy/default (hardcoded as backup)
    IF v_system_id IS NULL THEN
        IF p_score >= 80 THEN RETURN QUERY SELECT 'A'::text, 12, 'Excellent'::text;
        ELSIF p_score >= 75 THEN RETURN QUERY SELECT 'A-'::text, 11, 'Very Good'::text;
        ELSIF p_score >= 70 THEN RETURN QUERY SELECT 'B+'::text, 10, 'Good'::text;
        ELSIF p_score >= 65 THEN RETURN QUERY SELECT 'B'::text, 9, 'Good'::text;
        ELSIF p_score >= 60 THEN RETURN QUERY SELECT 'B-'::text, 8, 'Fair'::text;
        ELSIF p_score >= 55 THEN RETURN QUERY SELECT 'C+'::text, 7, 'Fair'::text;
        ELSIF p_score >= 50 THEN RETURN QUERY SELECT 'C'::text, 6, 'Average'::text;
        ELSIF p_score >= 45 THEN RETURN QUERY SELECT 'C-'::text, 5, 'Average'::text;
        ELSIF p_score >= 40 THEN RETURN QUERY SELECT 'D+'::text, 4, 'Weak'::text;
        ELSIF p_score >= 35 THEN RETURN QUERY SELECT 'D'::text, 3, 'Weak'::text;
        ELSIF p_score >= 30 THEN RETURN QUERY SELECT 'D-'::text, 2, 'Poor'::text;
        ELSE RETURN QUERY SELECT 'E'::text, 1, 'Fail'::text;
        END IF;
        RETURN;
    END IF;

    -- 2. Check for Subject Override
    -- Logic: See if there is an override range in this system for this subject that matches the score
    IF p_subject_id IS NOT NULL THEN
        SELECT grade_label, grade_points, remarks 
        INTO v_override_record
        FROM subject_grading_overrides
        WHERE grading_system_id = v_system_id
          AND subject_id = p_subject_id
          AND p_score BETWEEN min_percentage AND max_percentage
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT v_override_record.grade_label, v_override_record.grade_points, v_override_record.remarks;
            RETURN;
        END IF;
    END IF;

    -- 3. Check Standard Scale
    SELECT grade_label, grade_points, remarks
    INTO v_scale_record
    FROM grading_scales
    WHERE grading_system_id = v_system_id
      AND p_score BETWEEN min_percentage AND max_percentage
    ORDER BY min_percentage DESC -- Higher grades first usually not needed if ranges distinct, but safety
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT v_scale_record.grade_label, v_scale_record.grade_points, v_scale_record.remarks;
    ELSE
        -- Fallback if gaps in range (should not happen with validation)
        RETURN QUERY SELECT 'E'::text, 0, 'No Grade'::text; 
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- SEED DATA: Default Grading System (KCSE)
DO $$
DECLARE
    v_sys_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM grading_systems) THEN
        INSERT INTO grading_systems (name, is_active) 
        VALUES ('KCSE Standard', true) 
        RETURNING id INTO v_sys_id;

        INSERT INTO grading_scales (grading_system_id, grade_label, min_percentage, max_percentage, grade_points, remarks) VALUES
        (v_sys_id, 'A',  80, 100, 12, 'Excellent'),
        (v_sys_id, 'A-', 75, 79,  11, 'Very Good'),
        (v_sys_id, 'B+', 70, 74,  10, 'Good'),
        (v_sys_id, 'B',  65, 69,  9,  'Good'),
        (v_sys_id, 'B-', 60, 64,  8,  'Fair'),
        (v_sys_id, 'C+', 55, 59,  7,  'Fair'),
        (v_sys_id, 'C',  50, 54,  6,  'Average'),
        (v_sys_id, 'C-', 45, 49,  5,  'Average'),
        (v_sys_id, 'D+', 40, 44,  4,  'Weak'),
        (v_sys_id, 'D',  35, 39,  3,  'Weak'),
        (v_sys_id, 'D-', 30, 34,  2,  'Very Weak'),
        (v_sys_id, 'E',  0,  29,  1,  'Poor');
    END IF;
END $$;
