-- Standardize Class Names to LOWERCASE (Safe Version - Fixes 42P10 Error)
-- User Preference: "form 1", "grade 6" (lowercase)
-- Goal: Merge "Title Case" (Form 1) into "Lowercase" (form 1)

BEGIN;

-- 1. Ensure Lowercase Classes Exist (Using WHERE NOT EXISTS to avoid constraint errors)
INSERT INTO classes (name, form_level)
SELECT DISTINCT lower(name), form_level
FROM classes c
WHERE name != lower(name)
AND NOT EXISTS (
    SELECT 1 FROM classes existing 
    WHERE existing.name = lower(c.name)
);

-- 2. Move Teacher Assignments from Title Case to Lowercase
DO $$
DECLARE
    dup_rec RECORD;
    target_id UUID;
    source_id UUID;
BEGIN
    -- Loop through all classes that are NOT lowercase (e.g. "Form 1")
    FOR dup_rec IN 
        SELECT id, name, form_level 
        FROM classes 
        WHERE name != lower(name) 
    LOOP
        source_id := dup_rec.id;
        
        -- Find the target "Lowercase" class ID
        SELECT id INTO target_id 
        FROM classes 
        WHERE name = lower(dup_rec.name);

        IF target_id IS NOT NULL AND target_id != source_id THEN
            RAISE NOTICE 'Merging % (ID: %) into % (ID: %)', dup_rec.name, source_id, lower(dup_rec.name), target_id;

            -- A. Move teacher_classes
            UPDATE teacher_classes
            SET class_id = target_id
            WHERE class_id = source_id
            AND teacher_id NOT IN (
                SELECT teacher_id FROM teacher_classes WHERE class_id = target_id
            );

            -- Delete remaining (duplicates in assignments)
            DELETE FROM teacher_classes WHERE class_id = source_id;

            -- B. Move Students (profiles)
            -- If students have "Form 1", change to "form 1"
            UPDATE profiles 
            SET form_class = lower(dup_rec.name)
            WHERE form_class = dup_rec.name;

            -- C. Move Marks
            UPDATE marks SET class_id = target_id WHERE class_id = source_id;
            
            -- D. Move Assignments
            UPDATE assignments SET class_id = target_id WHERE class_id = source_id;

            -- E. Delete Source Class
            DELETE FROM classes WHERE id = source_id;
        END IF;
    END LOOP;
END $$;

COMMIT;

-- 3. Verify Final List
SELECT id, name, form_level FROM classes ORDER BY name;
