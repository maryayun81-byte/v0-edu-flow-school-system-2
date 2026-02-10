-- FIX MESSAGING FINAL V4 (COMPREHENSIVE)
-- This script addresses:
-- 1. Missing 'typing_indicators' table (404 error)
-- 2. Message Foreign Key Relationship (PGRST200 error)
-- 3. Infinite Recursion in RLS (500 error)

BEGIN;

--------------------------------------------------------------------------------
-- 1. CREATE MISSING TABLES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS typing_indicators (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Enable RLS on typing_indicators
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON typing_indicators TO authenticated;
GRANT ALL ON typing_indicators TO service_role;

--------------------------------------------------------------------------------
-- 2. DROP ALL EXISTING POLICIES (Start Clean)
--------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('messages', 'conversations', 'conversation_participants', 'typing_indicators')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 3. FIX FOREIGN KEYS & COLUMNS
--------------------------------------------------------------------------------
-- Fix Messages sender_id
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
-- 4. SECURITY DEFINER FUNCTIONS (Avoid Recursion)
--------------------------------------------------------------------------------
-- This function checks participation IGNORING RLS
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
-- 5. RE-APPLY RLS POLICIES (Safe Versions)
--------------------------------------------------------------------------------

-- A. CONVERSATIONS
-- View: If you created it OR are a participant
CREATE POLICY "View conversations" ON conversations
FOR SELECT USING (
    created_by = auth.uid() OR is_conversation_participant(id)
);

-- Insert: Authenticated users can create
CREATE POLICY "Insert conversations" ON conversations
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- B. PARTICIPANTS
-- View: If you are seeing your own row OR you are already a participant in that chat
CREATE POLICY "View participants" ON conversation_participants
FOR SELECT USING (
    user_id = auth.uid() OR is_conversation_participant(conversation_id)
);

-- Insert: Open for now to allow creating chats
CREATE POLICY "Insert participants" ON conversation_participants
FOR INSERT WITH CHECK (true);

-- C. MESSAGES
-- View: If participant
CREATE POLICY "View messages" ON messages
FOR SELECT USING (
    is_conversation_participant(conversation_id)
);

-- Insert: If participant and is sender
CREATE POLICY "Insert messages" ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND is_conversation_participant(conversation_id)
);

-- D. TYPING INDICATORS
-- View/Insert/Delete: If participant
CREATE POLICY "Manage typing indicators" ON typing_indicators
FOR ALL USING (
    is_conversation_participant(conversation_id)
);

--------------------------------------------------------------------------------
-- 6. REALTIME PUBLICATION
--------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
    END IF;
END $$;

--------------------------------------------------------------------------------
-- 7. NOTIFY SCHEMA RELOAD
--------------------------------------------------------------------------------
NOTIFY pgrst, 'reload config';

COMMIT;
