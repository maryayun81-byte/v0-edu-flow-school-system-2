-- Assign classes to teachers who have none
-- This script finds teachers with NO classes and assigns them to ALL available classes
-- with default subjects: Mathematics, English.

DO $$
DECLARE
    teacher_rec RECORD;
    class_rec RECORD;
    v_count INTEGER;
BEGIN
    -- Loop through teachers who have NO entries in teacher_classes
    FOR teacher_rec IN 
        SELECT id, full_name, email 
        FROM profiles 
        WHERE role = 'teacher' 
        AND id NOT IN (SELECT teacher_id FROM teacher_classes)
    LOOP
        RAISE NOTICE 'Assigning classes to teacher: % (%)', teacher_rec.full_name, teacher_rec.email;

        -- For each such teacher, assign them to EVERY class
        FOR class_rec IN SELECT id, name FROM classes LOOP
            
            -- Check if assignment already exists (paranoia check)
            SELECT COUNT(*) INTO v_count 
            FROM teacher_classes 
            WHERE teacher_id = teacher_rec.id AND class_id = class_rec.id;

            IF v_count = 0 THEN
                INSERT INTO teacher_classes (teacher_id, class_id, subjects)
                VALUES (
                    teacher_rec.id, 
                    class_rec.id, 
                    ARRAY['Mathematics', 'English', 'Kiswahili', 'Science'] -- Default subjects
                );
            END IF;
            
        END LOOP;
    END LOOP;
END $$;
