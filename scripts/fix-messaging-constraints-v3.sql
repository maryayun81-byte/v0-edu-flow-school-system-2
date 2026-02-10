-- FIX MESSAGING CONSTRAINTS (V3)
-- 1. Fix Conversation Participants Role Constraint (use correct column 'user_role')
-- The error "violates check constraint" on 'member' suggests the constraint is too strict.
-- We will drop and recreate it to allow 'member'.

DO $$
BEGIN
    -- Drop the constraint if it exists (we need to know the name, usually generic or named explicitly)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_user_role_check') THEN
        ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_user_role_check;
    END IF;

    -- Add a more permissive constraint on 'user_role' (not 'role')
    ALTER TABLE conversation_participants 
    ADD CONSTRAINT conversation_participants_user_role_check 
    CHECK (user_role IN ('admin', 'member', 'teacher', 'student'));

END $$;

-- 2. Fix Teacher's Student Fetching (Make it VERY robust)
-- If JSON parsing of subjects fails, or no subjects are overlapping, we still want to see the student.
-- We will remove the INNER JOIN on subjects and specific JSON parsing that filters rows.

DROP FUNCTION IF EXISTS get_teacher_messageable_students(UUID);

CREATE OR REPLACE FUNCTION get_teacher_messageable_students(teacher_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    student_class TEXT,
    student_avatar TEXT,
    shared_subjects TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id as student_id,
        p.full_name as student_name,
        c.name as student_class,
        p.avatar_url as student_avatar,
        -- We return a generic subject array or try to aggregate safely
        ARRAY['All Subjects'] as shared_subjects
    FROM teacher_classes tc
    JOIN classes c ON tc.class_id = c.id
    JOIN student_classes sc ON sc.class_id = c.id
    JOIN profiles p ON p.id = sc.student_id
    -- Removed the CROSS JOIN LATERAL on subjects to prevent filtering
    WHERE tc.teacher_id = teacher_id;
END;
$$;

-- 3. Fix Student's Classmate Fetching (Make it robust)
-- Ensure 'sc_me' class matches 'sc_other' class
DROP FUNCTION IF EXISTS get_student_messageable_classmates(UUID);

CREATE OR REPLACE FUNCTION get_student_messageable_classmates(student_id UUID)
RETURNS TABLE (
    classmate_id UUID,
    classmate_name TEXT,
    classmate_avatar TEXT,
    shared_subjects TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id as classmate_id,
        p.full_name as classmate_name,
        p.avatar_url as classmate_avatar,
        ARRAY[c.name] as shared_subjects
    FROM student_classes sc_me
    JOIN student_classes sc_other ON sc_me.class_id = sc_other.class_id
    JOIN classes c ON sc_me.class_id = c.id
    JOIN profiles p ON p.id = sc_other.student_id
    WHERE sc_me.student_id = student_id
    AND sc_other.student_id != student_id;
END;
$$;

-- 4. Just in case, grant permissions again
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
