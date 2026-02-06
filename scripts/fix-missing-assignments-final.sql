-- FINAL FIX: Ensure Classes Exist AND Migrate Preferences (Safe Version)
-- Run this script to fix the "No Classes" issue once and for all.

BEGIN;

-- 1. Ensure Classes Exist (Using WHERE NOT EXISTS to avoid constraint errors)
INSERT INTO classes (name, form_level)
SELECT v.name, v.form_level
FROM (VALUES 
    ('Form 1', 'Form 1'),
    ('Form 2', 'Form 2'),
    ('Form 3', 'Form 3'),
    ('Form 4', 'Form 4'),
    ('Grade 6', 'Grade 6 (CBC)'),
    ('Grade 7', 'Grade 7 (JSS) (CBC)'),
    ('Grade 8', 'Grade 8 (JSS) (CBC)'),
    ('Grade 9', 'Grade 9 (JSS) (CBC)')
) as v(name, form_level)
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name = v.name);

-- 2. Migrate Preferences (using JSONB)
DO $$
DECLARE
    pref_rec RECORD;
    v_class_id UUID;
    v_exists BOOLEAN;
BEGIN
    FOR pref_rec IN 
        SELECT teacher_id, subject, unnest(preferred_classes) as class_name
        FROM teacher_subject_preferences
    LOOP
        -- Find Class ID
        SELECT id INTO v_class_id
        FROM classes 
        WHERE name ILIKE pref_rec.class_name
           OR name ILIKE REPLACE(pref_rec.class_name, 'Grade ', 'Grade')
           OR form_level ILIKE pref_rec.class_name
        LIMIT 1;

        IF v_class_id IS NOT NULL THEN
            -- Check existence
            SELECT EXISTS (
                SELECT 1 FROM teacher_classes 
                WHERE teacher_id = pref_rec.teacher_id 
                AND class_id = v_class_id
            ) INTO v_exists;

            IF v_exists THEN
                -- Append subject if missing
                UPDATE teacher_classes
                SET subjects = subjects || jsonb_build_array(pref_rec.subject)
                WHERE teacher_id = pref_rec.teacher_id 
                AND class_id = v_class_id
                AND NOT (subjects @> jsonb_build_array(pref_rec.subject));
            ELSE
                -- Insert new assignment
                INSERT INTO teacher_classes (teacher_id, class_id, subjects)
                VALUES (pref_rec.teacher_id, v_class_id, jsonb_build_array(pref_rec.subject));
            END IF;
        END IF;
    END LOOP;
END $$;

COMMIT;

-- 3. Show Final Results (Assignments)
SELECT 
    p.full_name as Teacher,
    c.name as Class,
    tc.subjects as Subjects
FROM teacher_classes tc
JOIN profiles p ON p.id = tc.teacher_id
JOIN classes c ON c.id = tc.class_id
ORDER BY p.full_name, c.name;
