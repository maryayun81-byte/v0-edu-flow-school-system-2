-- FIX MESSAGING FEATURE FINAL
-- This script implements the missing RPC functions expected by the frontend
-- and ensures the messaging system works for all roles.

-- Drop existing functions to allow signature changes
DROP FUNCTION IF EXISTS get_student_messageable_teachers(UUID);
DROP FUNCTION IF EXISTS get_student_messageable_classmates(UUID);
DROP FUNCTION IF EXISTS get_teacher_messageable_students(UUID);
DROP FUNCTION IF EXISTS get_or_create_conversation(UUID, UUID);

-- 1. Get Student's Messageable Teachers
-- Returns teachers who teach classes the student is enrolled in
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
        -- Aggregate subjects if multiple
        string_agg(DISTINCT s.name, ', ') as teacher_subject,
        p.avatar_url as teacher_avatar
    FROM student_classes sc
    JOIN classes c ON sc.class_id = c.id
    JOIN teacher_classes tc ON tc.class_id = c.id
    JOIN profiles p ON p.id = tc.teacher_id
    CROSS JOIN LATERAL jsonb_array_elements_text(tc.subjects) sub_id
    JOIN subjects s ON s.id = sub_id::uuid
    WHERE sc.student_id = student_id
    GROUP BY p.id, p.full_name, p.avatar_url;
END;
$$;

-- 2. Get Student's Messageable Classmates
-- Returns students in the same classes
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
        ARRAY_AGG(DISTINCT c.name) as shared_subjects -- Actually sharing Classes not subjects directly, but reusing field name
    FROM student_classes sc_me
    JOIN student_classes sc_other ON sc_me.class_id = sc_other.class_id
    JOIN classes c ON sc_me.class_id = c.id
    JOIN profiles p ON p.id = sc_other.student_id
    WHERE sc_me.student_id = student_id
    AND sc_other.student_id != student_id
    GROUP BY p.id, p.full_name, p.avatar_url;
END;
$$;

-- 3. Get Teacher's Messageable Students
-- Returns students in classes taught by the teacher
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
        ARRAY_AGG(DISTINCT s.name) as shared_subjects
    FROM teacher_classes tc
    JOIN classes c ON tc.class_id = c.id
    JOIN student_classes sc ON sc.class_id = c.id
    JOIN profiles p ON p.id = sc.student_id
    CROSS JOIN LATERAL jsonb_array_elements_text(tc.subjects) sub_id
    JOIN subjects s ON s.id = sub_id::uuid
    WHERE tc.teacher_id = teacher_id
    GROUP BY p.id, p.full_name, c.name, p.avatar_url;
END;
$$;

-- 4. Get or Create Conversation (Matching Frontend Signature)
-- Supports 2 args: user1_id, user2_id
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    conv_id UUID;
BEGIN
    -- Security Check: One of the users MUST be the authenticated user
    IF auth.uid() != user1_id AND auth.uid() != user2_id THEN
        RAISE EXCEPTION 'Not authorized to create conversation for other users';
    END IF;

    -- Check if direct conversation exists
    SELECT c.id INTO conv_id
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.type = 'direct'
    AND cp1.user_id = user1_id
    AND cp2.user_id = user2_id;

    -- If not found, create it
    IF conv_id IS NULL THEN
        INSERT INTO conversations (type, created_by)
        VALUES ('direct', auth.uid())
        RETURNING id INTO conv_id;

        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES 
            (conv_id, user1_id), 
            (conv_id, user2_id);
    END IF;

    RETURN conv_id;
END;
$$;

-- 5. Fix RLS for Conversation Participants to allow viewing profiles
-- (Profiles table usually has RLS, ensure it's selectable)
-- Assumes profiles table is public-read or has proper policies.

-- 6. Ensure messages table RLS allows sender to insert
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = messages.conversation_id 
        AND user_id = auth.uid()
    )
);
