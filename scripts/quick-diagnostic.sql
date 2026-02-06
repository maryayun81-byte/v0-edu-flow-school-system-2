-- Quick diagnostic - Run each query separately and share results

-- Query 1: Check if classes exist
SELECT COUNT(*) as total_classes FROM classes;

-- Query 2: List all classes
SELECT id, name, form_level FROM classes ORDER BY name;

-- Query 3: Check teacher assignments
SELECT COUNT(*) as total_teacher_assignments FROM teacher_classes;

-- Query 4: Check exams
SELECT 
    exam_name, 
    status, 
    system_type,
    applicable_classes,
    array_length(applicable_classes, 1) as num_classes
FROM exams 
ORDER BY created_at DESC 
LIMIT 5;
