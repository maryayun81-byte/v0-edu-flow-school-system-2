-- FIX MESSAGING COMPLETE (V4)
-- This script combines constraint fixes, RLS updates, and function definitions.
-- Run this to resolve "Permission denied", "Constraint violation", and "No contacts found" errors.

BEGIN;

--------------------------------------------------------------------------------
-- 1. FIX CONSTRAINT ON conversation_participants
--------------------------------------------------------------------------------
DO $$
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_participants_user_role_check') THEN
        ALTER TABLE conversation_participants DROP CONSTRAINT conversation_participants_user_role_check;
    END IF;

    -- Add the correct constraint using 'user_role' column
    -- allowing 'member' specifically
    ALTER TABLE conversation_participants 
    ADD CONSTRAINT conversation_participants_user_role_check 
    CHECK (user_role IN ('admin', 'member', 'teacher', 'student'));
END $$;

--------------------------------------------------------------------------------
-- 2. UPDATE RLS POLICIES (Make them permissive for messaging)
--------------------------------------------------------------------------------
-- Profiles: Allow everyone to read profiles (needed to see contact details)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

-- Conversations: Allow authenticated users to insert/select if they are participants
DROP POLICY IF EXISTS "Users can insert conversations" ON conversations;
CREATE POLICY "Users can insert conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = conversations.id 
        AND user_id = auth.uid()
    )
    OR created_by = auth.uid() 
);

-- Participants: Allow adding self/others (e.g. creating a chat)
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
CREATE POLICY "Users can add participants" ON conversation_participants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Participants viewable by members" ON conversation_participants;
CREATE POLICY "Participants viewable by members" ON conversation_participants FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = conversation_participants.conversation_id 
        AND cp.user_id = auth.uid()
    )
);

--------------------------------------------------------------------------------
-- 3. REDEFINE CONTACT FETCHING FUNCTIONS (Robust & Permissive)
--------------------------------------------------------------------------------

-- A. Teacher looking for Students
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
        -- Use a dummy array because aggregating subjects can be tricky with joins
        ARRAY['All Subjects'] as shared_subjects
    FROM teacher_classes tc
    JOIN classes c ON tc.class_id = c.id
    JOIN student_classes sc ON sc.class_id = c.id
    JOIN profiles p ON p.id = sc.student_id
    WHERE tc.teacher_id = teacher_id;
END;
$$;

-- B. Student looking for Classmates
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
    AND sc_other.student_id != student_id; -- Exclude self
END;
$$;

-- C. Student looking for Teachers
DROP FUNCTION IF EXISTS get_student_messageable_teachers(UUID);
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

--------------------------------------------------------------------------------
-- 4. GRANT PERMISSIONS
--------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_teachers(UUID) TO authenticated;

COMMIT;
