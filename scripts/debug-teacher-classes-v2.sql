-- Check teacher classes after migration
-- Replace with the specific teacher details if known, or list all.

SELECT 
    p.email, 
    p.full_name, 
    c.name as class_name, 
    tc.subjects
FROM teacher_classes tc
JOIN profiles p ON p.id = tc.teacher_id
JOIN classes c ON c.id = tc.class_id
WHERE p.email LIKE '%mwaurajosephwarui%' OR p.email LIKE '%fgckmurang%'; 

-- Also check preferences just to be sure they are still there
SELECT * FROM teacher_subject_preferences;
