-- FIX MESSAGES RELATIONSHIP
-- The client is failing to join messages with sender because the foreign key is missing or ambiguous.

BEGIN;

-- 1. Check if constraint exists, if not add it
-- We try to add it. If it fails (duplicate), we catch it or use DO block.

DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_sender_id_fkey' 
        AND table_name = 'messages'
    ) THEN
        -- Add the foreign key
        ALTER TABLE messages
        ADD CONSTRAINT messages_sender_id_fkey
        FOREIGN KEY (sender_id)
        REFERENCES profiles (id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Verify column type matches (UUID)
-- Sometimes type mismatch breaks the relationship detection
DO $$
BEGIN
    -- Just a dummy check, ALTER won't hurt if same type
    ALTER TABLE messages 
    ALTER COLUMN sender_id TYPE UUID USING sender_id::UUID;
END $$;

-- 3. Notify Schema Cache Reload
-- Supabase/PostgREST caches schema structure.
-- We can force a reload by notifying pgrst.
NOTIFY pgrst, 'reload config';

COMMIT;
