-- FIX MESSAGING SCHEMA COLUMNS
-- The frontend expects 'is_deleted' and 'is_edited' columns on the 'messages' table, but they are missing.

BEGIN;

-- 1. Add 'is_deleted' if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_deleted') THEN
        ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Add 'is_edited' if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_edited') THEN
        ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';

COMMIT;
