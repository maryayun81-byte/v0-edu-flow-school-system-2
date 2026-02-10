-- FIX MESSAGE RELATIONSHIPS V2 (SAFE)
-- This script handles the "cannot alter type used in policy" error by dropping policies first.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DROP CONFLICTING POLICIES
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;
-- (Drop old names too just in case)
DROP POLICY IF EXISTS "Users can view messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

--------------------------------------------------------------------------------
-- 2. FIX FOREIGN KEY & COLUMN TYPE
--------------------------------------------------------------------------------
-- Now safe to alter column if needed
DO $$
BEGIN
    -- Ensure sender_id is UUID
    -- (If it's already UUID, this is a no-op, but safe now)
    ALTER TABLE messages 
    ALTER COLUMN sender_id TYPE UUID USING sender_id::UUID;

    -- Add Foreign Key if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_sender_id_fkey' 
        AND table_name = 'messages'
    ) THEN
        ALTER TABLE messages
        ADD CONSTRAINT messages_sender_id_fkey
        FOREIGN KEY (sender_id)
        REFERENCES profiles (id)
        ON DELETE SET NULL;
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 3. RESTORE POLICIES (Using the Recursion-Safe Logic)
--------------------------------------------------------------------------------
-- Helper function check (ensure it exists)
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

-- View Policy
CREATE POLICY "Users can view messages in their conversations" ON messages
FOR SELECT USING (
    is_conversation_participant(conversation_id)
);

-- Insert Policy
CREATE POLICY "Users can insert messages in their conversations" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id)
);

-- Ensure Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

COMMIT;
