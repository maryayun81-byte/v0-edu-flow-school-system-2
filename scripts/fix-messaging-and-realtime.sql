-- FIX MESSAGING AND REALTIME (SAFE)
-- This script safely applies RLS policies and publication settings without crashing on existing entries.

BEGIN;

--------------------------------------------------------------------------------
-- 1. FIX CONSTRAINTS ON conversation_participants (USER ROLE)
--------------------------------------------------------------------------------
-- Ensure we allow 'member', 'admin', 'teacher', 'student'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_user_role_check') THEN
        ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_user_role_check;
    END IF;
    
    ALTER TABLE conversation_participants 
    ADD CONSTRAINT conversation_participants_user_role_check 
    CHECK (user_role IN ('admin', 'member', 'teacher', 'student'));
END $$;

--------------------------------------------------------------------------------
-- 2. FIX RLS ON MESSAGES (VISIBILITY)
--------------------------------------------------------------------------------
-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;

-- Allow Viewing
CREATE POLICY "Users can view messages in their conversations" ON messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
);

-- Allow Sending
CREATE POLICY "Users can insert messages in their conversations" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
);

--------------------------------------------------------------------------------
-- 3. ENABLE REALTIME (SAFELY)
--------------------------------------------------------------------------------
-- We use DO blocks to avoid "relation already member of publication" errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 4. ENSURE CONTACT FUNCTIONS EXIST AND ARE CORRECT
--------------------------------------------------------------------------------

-- A. Teacher looking for Students
CREATE OR REPLACE FUNCTION get_teacher_messageable_students(teacher_id UUID)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    student_class TEXT,
    student_avatar TEXT,
    shared_subjects TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Just verify input is correct
    -- RAISE NOTICE 'Looking for students of teacher %', teacher_id;
    
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
    WHERE tc.teacher_id = teacher_id;
END;
$$;

-- B. Student looking for Classmates
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
    AND sc_other.student_id != student_id; -- Exclude self
END;
$$;

-- C. Student looking for Teachers
CREATE OR REPLACE FUNCTION get_student_messageable_teachers(student_id UUID)
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
    WHERE sc.student_id = student_id;
END;
$$;


-- 5. Grant permissions again (just to be sure)
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_teachers(UUID) TO authenticated;

COMMIT;
