-- Fix RLS policy on assignments to include student_subject_enrollments
DROP POLICY IF EXISTS "Students see assignments for their class and targeted delivery" ON assignments;

CREATE POLICY "Students see assignments for their class and targeted delivery" 
ON assignments FOR SELECT 
USING (
    status = 'PUBLISHED' 
    AND (
        EXISTS (
            SELECT 1 FROM student_classes 
            WHERE student_classes.student_id = auth.uid() 
            AND student_classes.class_id = assignments.class_id
        )
        OR
        EXISTS (
            SELECT 1 FROM student_subject_enrollments
            WHERE student_subject_enrollments.student_id = auth.uid()
            AND student_subject_enrollments.class_id = assignments.class_id
        )
        OR
        EXISTS (
            SELECT 1 FROM assignment_recipients
            WHERE assignment_recipients.student_id = auth.uid()
            AND assignment_recipients.assignment_id = assignments.id
        )
    )
);

-- Also fix assignment_files RLS
DROP POLICY IF EXISTS "Students can view assignment files" ON assignment_files;

CREATE POLICY "Students can view assignment files" 
ON assignment_files FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM assignments 
        WHERE assignments.id = assignment_id 
        AND status = 'PUBLISHED'
        AND (
            EXISTS (
                SELECT 1 FROM student_classes 
                WHERE student_classes.student_id = auth.uid() 
                AND student_classes.class_id = assignments.class_id
            )
            OR
            EXISTS (
                SELECT 1 FROM student_subject_enrollments
                WHERE student_subject_enrollments.student_id = auth.uid()
                AND student_subject_enrollments.class_id = assignments.class_id
            )
            OR
            EXISTS (
                SELECT 1 FROM assignment_recipients
                WHERE assignment_recipients.student_id = auth.uid()
                AND assignment_recipients.assignment_id = assignments.id
            )
        )
    )
);
