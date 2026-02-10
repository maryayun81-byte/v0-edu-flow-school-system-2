-- SYNC STUDENT CLASSES FROM PROFILES
-- Validates if students have 'form_class' in profiles but are missing from 'student_classes'.
-- Then syncs them.

BEGIN;

-- 1. Check if 'form_class' column exists and has data
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT count(*) INTO row_count FROM profiles WHERE role = 'student' AND form_class IS NOT NULL;
    RAISE NOTICE 'Found % students with form_class in profiles.', row_count;
END $$;

-- 2. Insert into student_classes based on matching class names
INSERT INTO student_classes (student_id, class_id)
SELECT p.id, c.id
FROM profiles p
JOIN classes c ON c.name = p.form_class -- Assuming stored as name string
WHERE p.role = 'student'
AND p.form_class IS NOT NULL
ON CONFLICT (student_id, class_id) DO NOTHING;

-- 3. Report results
SELECT count(*) as total_student_classes_after_sync FROM student_classes;

COMMIT;
