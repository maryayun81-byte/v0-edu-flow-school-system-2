-- SEED STUDENT CLASSES
-- The 'student_classes' table is empty, breaking messaging contact discovery.
-- This script assigns every student to at least one class (randomly or sequentially).

BEGIN;

DO $$
DECLARE
    student_rec RECORD;
    class_rec RECORD;
    iter INTEGER := 0;
BEGIN
    -- 1. Loop through all students
    FOR student_rec IN SELECT id, full_name FROM profiles WHERE role = 'student' LOOP
        
        -- 2. Pick a class relative to the iteration (round-robin)
        -- This ensures students are spread across available classes
        SELECT id, name INTO class_rec FROM classes 
        ORDER BY id 
        LIMIT 1 OFFSET (iter % (SELECT count(*) FROM classes));
        
        -- 3. Insert if not exists
        IF class_rec.id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM student_classes 
                WHERE student_id = student_rec.id AND class_id = class_rec.id
            ) THEN
                INSERT INTO student_classes (student_id, class_id)
                VALUES (student_rec.id, class_rec.id);
                
                RAISE NOTICE 'Assigned student % to class %', student_rec.full_name, class_rec.name;
            END IF;
        END IF;
        
        iter := iter + 1;
    END LOOP;
END $$;

-- 4. Verify counts
SELECT count(*) as student_classes_count FROM student_classes;

COMMIT;
