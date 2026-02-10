-- FIX MESSAGE RELATIONSHIPS V3 (ROBUST)
-- This version dynamically drops ALL policies on the 'messages' table to ensure no dependencies block the column alteration.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DROP ALL POLICIES ON MESSAGES (Dynamically)
--------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'messages') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON messages', r.policyname);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 2. FIX FOREIGN KEY & COLUMN TYPE
--------------------------------------------------------------------------------
-- Now safe to alter column (no policies exist)
DO $$
BEGIN
    -- Ensure sender_id is UUID
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
-- Create Helper Function if not exists
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

--------------------------------------------------------------------------------
-- 4. ENSURE REALTIME
--------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

COMMIT;
