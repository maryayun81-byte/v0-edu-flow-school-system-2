-- Validate if preferred classes exist in the classes table
-- This helps us check if migration failed due to missing classes or name mismatches

WITH preferences AS (
    SELECT unnest(preferred_classes) as class_name FROM teacher_subject_preferences
)
SELECT 
    p.class_name as preferred_name,
    c.id as existing_id,
    c.name as existing_name
FROM preferences p
LEFT JOIN classes c ON c.name ILIKE p.class_name 
                    OR c.name ILIKE REPLACE(p.class_name, 'Grade ', 'Grade')
                    OR c.form_level ILIKE p.class_name;

-- Also show ALL classes again to be sure
SELECT id, name, form_level FROM classes ORDER BY name;
