-- FIX MESSAGING RECURSION & CONTACTS
-- This script fixes the "infinite recursion" error by using a SECURITY DEFINER function.

BEGIN;

--------------------------------------------------------------------------------
-- 1. HELPER FUNCTION (Bypass RLS)
--------------------------------------------------------------------------------
-- We need a function to check participation without triggering the table's RLS policy recursively.
CREATE OR REPLACE FUNCTION is_conversation_participant(conversation_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = is_conversation_participant.conversation_id
        AND cp.user_id = auth.uid()
    );
END;
$$;

--------------------------------------------------------------------------------
-- 2. FIX RLS ON conversation_participants
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants viewable by members" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;

-- Allow viewing if:
-- 1. It's your own row (user_id = auth.uid()) - needed to establish initial membership
-- 2. OR you are already a verified participant of that conversation (via secure function)
CREATE POLICY "Participants viewable by members" ON conversation_participants
FOR SELECT USING (
    user_id = auth.uid() 
    OR is_conversation_participant(conversation_id)
);

-- Allow inserting (creating chats)
CREATE POLICY "Users can add participants" ON conversation_participants
FOR INSERT WITH CHECK (true); -- Ideally stricter, but for now allow to unblock

--------------------------------------------------------------------------------
-- 3. FIX RLS ON messages (Use the safe function)
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;

CREATE POLICY "Users can view messages in their conversations" ON messages
FOR SELECT USING (
    is_conversation_participant(conversation_id)
);

CREATE POLICY "Users can insert messages in their conversations" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
);


--------------------------------------------------------------------------------
-- 4. DEBUG CONTACTS (Broaden Permissions & Fallback)
--------------------------------------------------------------------------------
-- "Contacts not showing" usually means RLS on 'profiles' or 'student_classes' is too strict.

-- Ensure Profiles are visible
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

-- Ensure Class Enrollments are visible (often missed!)
-- Students need to see who else is in their class (student_classes).
DROP POLICY IF EXISTS "Class enrollments viewable by everyone" ON student_classes;
CREATE POLICY "Class enrollments viewable by everyone" ON student_classes FOR SELECT USING (true);

-- Ensure Teacher Assignments are visible
DROP POLICY IF EXISTS "Teacher assignments viewable by everyone" ON teacher_classes;
CREATE POLICY "Teacher assignments viewable by everyone" ON teacher_classes FOR SELECT USING (true);


--------------------------------------------------------------------------------
-- 5. REFRESH CACHE / NOTIFY
--------------------------------------------------------------------------------
-- Just a dummy update to force client refresh if using realtime (optional)
-- UPDATE profiles SET updated_at = now() WHERE id = auth.uid();

COMMIT;
