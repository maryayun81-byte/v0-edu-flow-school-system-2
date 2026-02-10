-- FIX MESSAGING FOREIGN KEY FINAL
-- The existing foreign key points to 'auth.users', causing usage of 'profiles' in joins to fail.
-- We re-point it to 'public.profiles'.

BEGIN;

--------------------------------------------------------------------------------
-- 1. DROP EXISTING CONFLICTING FK
--------------------------------------------------------------------------------
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

--------------------------------------------------------------------------------
-- 2. ADD NEW FK TO PROFILES
--------------------------------------------------------------------------------
ALTER TABLE messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id)
REFERENCES public.profiles (id)
ON DELETE SET NULL;

--------------------------------------------------------------------------------
-- 3. ENSURE RLS DOES NOT BREAK
--------------------------------------------------------------------------------
-- (The RLS fixes from previous scripts should be fine as they use functions/queries)

--------------------------------------------------------------------------------
-- 4. RELOAD SCHEMA CACHE
--------------------------------------------------------------------------------
NOTIFY pgrst, 'reload config';

COMMIT;
