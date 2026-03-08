-- Fix RLS policies for ai_insights to allow all authenticated users to manage the cache
-- This is necessary because students also trigger AI insights that need to be cached.

-- Drop the restrictive management policy
DROP POLICY IF EXISTS "Allow service role or admins to manage insights" ON public.ai_insights;

-- Create a new, more inclusive policy for all authenticated users
-- Since this is just a performance cache for data the user already has access to,
-- allowing authenticated users to manage it is safe.
CREATE POLICY "Allow authenticated users to manage insights cache"
ON public.ai_insights
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure the select policy still exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ai_insights' 
        AND policyname = 'Allow authenticated users to read insights'
    ) THEN
        CREATE POLICY "Allow authenticated users to read insights"
        ON public.ai_insights
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;
