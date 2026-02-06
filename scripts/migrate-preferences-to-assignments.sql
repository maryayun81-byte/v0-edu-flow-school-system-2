-- Migrate Teacher Preferences to Official Class Assignments (Fixed for JSONB)
-- This script takes the data from 'teacher_subject_preferences' and inserts it into 'teacher_classes'.

DO $$
DECLARE
    pref_rec RECORD;
    v_class_id UUID;
    v_exists BOOLEAN;
BEGIN
    -- Loop through each preference entry
    FOR pref_rec IN 
        SELECT teacher_id, subject, unnest(preferred_classes) as class_name
        FROM teacher_subject_preferences
    LOOP
        -- 1. Try to find the matching Class ID
        SELECT id INTO v_class_id
        FROM classes 
        WHERE name ILIKE pref_rec.class_name
           OR name ILIKE REPLACE(pref_rec.class_name, 'Grade ', 'Grade')
           OR form_level ILIKE pref_rec.class_name
        LIMIT 1;

        -- If we found a valid class for this preference
        IF v_class_id IS NOT NULL THEN
            RAISE NOTICE 'Migrating: Teacher % -> Subject % -> Class % (ID: %)', 
                pref_rec.teacher_id, pref_rec.subject, pref_rec.class_name, v_class_id;

            -- 2. Check if assignment already exists
            SELECT EXISTS (
                SELECT 1 FROM teacher_classes 
                WHERE teacher_id = pref_rec.teacher_id 
                AND class_id = v_class_id
            ) INTO v_exists;

            IF v_exists THEN
                -- 3a. Update existing assignment: Add subject if not present (JSONB logic)
                UPDATE teacher_classes
                SET subjects = subjects || jsonb_build_array(pref_rec.subject)
                WHERE teacher_id = pref_rec.teacher_id 
                AND class_id = v_class_id
                AND NOT (subjects @> jsonb_build_array(pref_rec.subject)); -- Only if not already in array
            ELSE
                -- 3b. Insert new assignment (JSONB logic)
                INSERT INTO teacher_classes (teacher_id, class_id, subjects)
                VALUES (pref_rec.teacher_id, v_class_id, jsonb_build_array(pref_rec.subject));
            END IF;
            
        ELSE
            RAISE NOTICE 'WARNING: Could not find class for preference "%", skipping.', pref_rec.class_name;
        END IF;
    END LOOP;
END $$;
