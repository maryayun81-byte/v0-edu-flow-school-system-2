-- FIX MESSAGE VISIBILITY & DEBUG CONTACTS

BEGIN;

--------------------------------------------------------------------------------
-- 1. FIX RLS ON MESSAGES
--------------------------------------------------------------------------------
-- Ensure that anyone who is a participant of a conversation can VIEW its messages.
-- Existing policies might be "Users can see their own messages" which hides incoming ones,
-- or "Users can insert" but not select.

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" ON messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
CREATE POLICY "Users can insert messages in their conversations" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
);

-- Ensure real-time works (Supabase Realtime requires the Table to be in the publication)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

--------------------------------------------------------------------------------
-- 2. DEBUG CONTACTS DATA (Function to safely inspect links)
--------------------------------------------------------------------------------
-- Create a secure function to check if the links actually exist for a given user
-- usage: select * from debug_msg_links('USER_UUID');

CREATE OR REPLACE FUNCTION debug_msg_links(target_user_id UUID)
RETURNS TABLE (
    entity_type TEXT,
    entity_name TEXT,
    details TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Check Profile
    RETURN QUERY SELECT 'Profile', full_name, role FROM profiles WHERE id = target_user_id;

    -- Check Student Enrollments
    RETURN QUERY 
    SELECT 'Student Class', c.name, 'Enrolled'
    FROM student_classes sc
    JOIN classes c ON sc.class_id = c.id
    WHERE sc.student_id = target_user_id;

    -- Check Teacher Assignments
    RETURN QUERY 
    SELECT 'Teacher Class', c.name, 'Assigned'
    FROM teacher_classes tc
    JOIN classes c ON tc.class_id = c.id
    WHERE tc.teacher_id = target_user_id;

    -- Check Conversations
    RETURN QUERY
    SELECT 'Conversation', c.type::text, c.id::text
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = target_user_id;
END;
$$;

COMMIT;
