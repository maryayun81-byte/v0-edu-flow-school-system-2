-- =============================================
-- DIAGNOSTIC SCRIPT: Class Visibility Issues
-- Run this to identify why classes aren't showing
-- =============================================

-- 1. CHECK: Do classes exist?
SELECT 
    'CLASSES' as check_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN name LIKE 'Grade%' THEN 1 END) as cbc_classes,
    COUNT(CASE WHEN name LIKE 'Form%' THEN 1 END) as form_classes,
    COUNT(CASE WHEN name NOT LIKE 'Grade%' AND name NOT LIKE 'Form%' THEN 1 END) as other_classes
FROM classes;

-- 2. LIST: All classes with naming convention check
SELECT 
    id,
    name,
    form_level,
    CASE 
        WHEN name LIKE 'Grade%' THEN 'CBC'
        WHEN name LIKE 'Form%' THEN '8-4-4'
        ELSE 'UNKNOWN - FIX NAMING!'
    END as curriculum_match
FROM classes
ORDER BY name;

-- 3. CHECK: Teacher assignments
SELECT 
    'TEACHER_ASSIGNMENTS' as check_type,
    COUNT(*) as total_assignments,
    COUNT(DISTINCT teacher_id) as unique_teachers,
    COUNT(DISTINCT class_id) as unique_classes
FROM teacher_classes;

-- 4. LIST: Teacher assignments with details
SELECT 
    tc.id,
    p.full_name as teacher_name,
    p.email as teacher_email,
    c.name as class_name,
    tc.subjects
FROM teacher_classes tc
JOIN profiles p ON tc.teacher_id = p.id
JOIN classes c ON tc.class_id = c.id
ORDER BY p.full_name, c.name;

-- 5. CHECK: Exams configuration
SELECT 
    'EXAMS' as check_type,
    COUNT(*) as total_exams,
    COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_exams,
    COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_exams,
    COUNT(CASE WHEN applicable_classes IS NULL THEN 1 END) as exams_without_classes,
    COUNT(CASE WHEN applicable_classes = '{}' THEN 1 END) as exams_with_empty_array
FROM exams;

-- 6. LIST: Exams with applicable classes
SELECT 
    id,
    exam_name,
    status,
    system_type,
    applicable_classes,
    array_length(applicable_classes, 1) as num_applicable_classes,
    term,
    academic_year
FROM exams
ORDER BY created_at DESC
LIMIT 10;

-- 7. CHECK: Cross-reference - Are exam's applicable_classes valid?
WITH exam_classes AS (
    SELECT 
        e.id as exam_id,
        e.exam_name,
        unnest(e.applicable_classes) as class_id
    FROM exams e
    WHERE e.applicable_classes IS NOT NULL 
    AND array_length(e.applicable_classes, 1) > 0
)
SELECT 
    ec.exam_name,
    ec.class_id,
    c.name as class_name,
    CASE WHEN c.id IS NULL THEN 'INVALID - Class does not exist!' ELSE 'Valid' END as status
FROM exam_classes ec
LEFT JOIN classes c ON ec.class_id = c.id
ORDER BY ec.exam_name, c.name;

-- 8. SPECIFIC CHECK: For a specific teacher (replace with actual teacher ID)
-- Uncomment and replace 'YOUR_TEACHER_ID' with actual UUID
/*
SELECT 
    'Teacher: ' || p.full_name as info,
    'Assigned Classes:' as section,
    c.name as class_name,
    tc.subjects
FROM teacher_classes tc
JOIN profiles p ON tc.teacher_id = p.id
JOIN classes c ON tc.class_id = c.id
WHERE tc.teacher_id = 'YOUR_TEACHER_ID';
*/

-- 9. SPECIFIC CHECK: For a specific exam (replace with actual exam ID)
-- Uncomment and replace 'YOUR_EXAM_ID' with actual UUID
/*
SELECT 
    'Exam: ' || e.exam_name as info,
    'Applicable Classes:' as section,
    c.name as class_name,
    c.form_level
FROM exams e
CROSS JOIN unnest(e.applicable_classes) as class_id
JOIN classes c ON c.id = class_id
WHERE e.id = 'YOUR_EXAM_ID';
*/

-- 10. SUMMARY: What might be wrong?
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM classes) = 0 THEN 'ERROR: No classes exist in database!'
        WHEN (SELECT COUNT(*) FROM classes WHERE name LIKE 'Grade%' OR name LIKE 'Form%') = 0 THEN 'ERROR: No classes follow naming convention (Grade/Form)!'
        WHEN (SELECT COUNT(*) FROM teacher_classes) = 0 THEN 'ERROR: No teacher assignments exist!'
        WHEN (SELECT COUNT(*) FROM exams WHERE status IN ('Active', 'Closed')) = 0 THEN 'ERROR: No active or closed exams!'
        WHEN (SELECT COUNT(*) FROM exams WHERE applicable_classes IS NULL OR applicable_classes = '{}') = (SELECT COUNT(*) FROM exams) THEN 'ERROR: All exams have no applicable_classes set!'
        ELSE 'Data looks OK - check application logic'
    END as diagnosis;
