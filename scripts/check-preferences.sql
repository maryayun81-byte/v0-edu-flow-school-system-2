-- Check teacher subject preferences
SELECT * FROM teacher_subject_preferences;

-- Check if we can map these preferences to actual classes
SELECT 
    tsp.teacher_id,
    tsp.subject,
    unnest(tsp.preferred_classes) as preferred_class_name
FROM teacher_subject_preferences tsp;
