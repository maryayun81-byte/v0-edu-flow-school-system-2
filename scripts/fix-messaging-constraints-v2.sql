-- FIX MESSAGING CONSTRAINTS AND TEACHER CONTACTS
-- 1. Fix Conversation Participants Role Constraint
-- The error "violates check constraint" on role 'member' suggests the constraint is too strict.
-- We will drop and recreate it to allow 'member' or just drop it if it's too problematic.
-- Assuming standard roles are 'admin', 'teacher', 'student'. 
-- But for chat, 'member' is a common generic role. Let's allow it.

DO $$
BEGIN
    -- Drop the constraint if it exists (we need to know the name, usually generic or named explicitly)
    -- Start by trying to drop common names or just replacing the column definition if possible?
    -- Safest is to ALTER TABLE DROP CONSTRAINT if we knew the name. The error said "conversation_participants_user_role_check".
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_user_role_check') THEN
        ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_user_role_check;
    END IF;

    -- Add a more permissive constraint
    ALTER TABLE conversation_participants 
    ADD CONSTRAINT conversation_participants_user_role_check 
    CHECK (role IN ('admin', 'member', 'teacher', 'student'));

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

-- 3. Update Conversation Creation to use 'member' safely (it already does, now the constraint allows it)
-- No change needed to the function IF the constraint is fixed. 

-- 4. Just in case, grant permissions again
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_teachers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID) TO authenticated;
