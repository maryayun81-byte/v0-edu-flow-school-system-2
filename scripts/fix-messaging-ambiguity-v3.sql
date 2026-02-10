-- FIX MESSAGING AMBIGUITY V3 (CASCADE SAFE)
-- This script handles dependencies by dropping policies, fixing the function, and re-applying policies.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DROP DEPENDENT POLICIES
--------------------------------------------------------------------------------
-- We need to drop these because they use 'is_conversation_participant'
DROP POLICY IF EXISTS "View conversations" ON conversations;
DROP POLICY IF EXISTS "View participants" ON conversation_participants;
DROP POLICY IF EXISTS "View messages" ON messages;
DROP POLICY IF EXISTS "Insert messages" ON messages;
DROP POLICY IF EXISTS "Manage typing indicators" ON typing_indicators;

--------------------------------------------------------------------------------
-- 2. FIX FUNCTIONS (Ambiguity Fix)
--------------------------------------------------------------------------------

-- A. is_conversation_participant
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

-- B. get_teacher_messageable_students
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
    WHERE tc.teacher_id = _teacher_id;
END;
$$;

-- C. get_student_messageable_classmates
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
    WHERE sc_me.student_id = _student_id
    AND sc_other.student_id != _student_id;
END;
$$;

-- D. get_student_messageable_teachers
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
    WHERE sc.student_id = _student_id;
END;
$$;


--------------------------------------------------------------------------------
-- 3. RESTORE POLICIES (Using the new function)
--------------------------------------------------------------------------------

-- Conversations
CREATE POLICY "View conversations" ON conversations
FOR SELECT USING (
    created_by = auth.uid() OR is_conversation_participant(id)
);

-- Participants
CREATE POLICY "View participants" ON conversation_participants
FOR SELECT USING (
    user_id = auth.uid() OR is_conversation_participant(conversation_id)
);

-- Messages
CREATE POLICY "View messages" ON messages
FOR SELECT USING (
    is_conversation_participant(conversation_id)
);

CREATE POLICY "Insert messages" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND is_conversation_participant(conversation_id)
);

-- Typing Indicators
CREATE POLICY "Manage typing indicators" ON typing_indicators
FOR ALL USING (
    is_conversation_participant(conversation_id)
);

--------------------------------------------------------------------------------
-- 4. GRANT PERMISSIONS
--------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_teachers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_conversation_participant(UUID) TO authenticated;

COMMIT;
