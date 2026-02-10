-- FIX MESSAGING AMBIGUITY V2 (SAFE)
-- This version explicitly DROPS all functions before recreating them to avoid "cannot change name of input parameter" errors.

BEGIN;

--------------------------------------------------------------------------------
-- 1. FIX get_teacher_messageable_students 
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_teacher_messageable_students(UUID);

CREATE OR REPLACE FUNCTION get_teacher_messageable_students(_teacher_id UUID)
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
        ARRAY['All Subjects'] as shared_subjects
    FROM teacher_classes tc
    JOIN classes c ON tc.class_id = c.id
    JOIN student_classes sc ON sc.class_id = c.id
    JOIN profiles p ON p.id = sc.student_id
    WHERE tc.teacher_id = _teacher_id; -- Use underscored parameter
END;
$$;

--------------------------------------------------------------------------------
-- 2. FIX get_student_messageable_classmates
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_student_messageable_classmates(UUID);

CREATE OR REPLACE FUNCTION get_student_messageable_classmates(_student_id UUID)
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
    WHERE sc_me.student_id = _student_id -- Use underscored parameter
    AND sc_other.student_id != _student_id;
END;
$$;

--------------------------------------------------------------------------------
-- 3. FIX get_student_messageable_teachers
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_student_messageable_teachers(UUID);

CREATE OR REPLACE FUNCTION get_student_messageable_teachers(_student_id UUID)
RETURNS TABLE (
    teacher_id UUID,
    teacher_name TEXT,
    teacher_subject TEXT,
    teacher_avatar TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.id as teacher_id,
        p.full_name as teacher_name,
        'Class Teacher' as teacher_subject,
        p.avatar_url as teacher_avatar
    FROM student_classes sc
    JOIN classes c ON sc.class_id = c.id
    JOIN teacher_classes tc ON tc.class_id = c.id
    JOIN profiles p ON p.id = tc.teacher_id
    WHERE sc.student_id = _student_id; -- Use underscored parameter
END;
$$;

--------------------------------------------------------------------------------
-- 4. FIX is_conversation_participant (CRITICAL FIX)
--------------------------------------------------------------------------------
-- We MUST drop it because we are renaming the input parameter from 'conversation_id' to '_conversation_id'
-- which PostgreSQL does not allow with CREATE OR REPLACE alone.
DROP FUNCTION IF EXISTS is_conversation_participant(UUID);

CREATE OR REPLACE FUNCTION is_conversation_participant(_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = _conversation_id
        AND cp.user_id = auth.uid()
    );
END;
$$;

-- Grant permissions re-application
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_teachers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_conversation_participant(UUID) TO authenticated;

COMMIT;
