-- Fix relationships for Supabase/PostgREST joins

-- 1. Ensure transcripts.student_id explicitly references profiles.id
-- This allows the query 'profiles!inner(...)' to work.
DO $$
BEGIN
    -- Check if constraint exists, if not add it.
    -- We first drop existing FK to auth.users if strictly enforcing profiles, 
    -- but usually multiple FKs are fine. Ideally we want PostgREST to find 'profiles'.
    -- The most robust way for PostgREST is an explicit FK to the target table.
    
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'transcripts_student_id_fkey_profiles'
    ) THEN
        -- We might need to drop the old one if it conflicts or causes ambiguity, 
        -- but adding a specific one for profiles is usually what's needed.
        -- Let's try adding it. 
        ALTER TABLE transcripts 
        ADD CONSTRAINT transcripts_student_id_fkey_profiles 
        FOREIGN KEY (student_id) 
        REFERENCES profiles(id);
    END IF;
END $$;

-- 2. Force schema cache reload (Supabase sometimes needs this)
NOTIFY pgrst, 'reload config';
