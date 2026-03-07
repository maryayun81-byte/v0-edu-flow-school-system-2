-- ============================================================
-- FIX: Student Login Profile Lookup
-- 
-- Problem: The student login page needs to look up a user's email
-- from their profile using their admission_number or username BEFORE
-- they are authenticated. But the current profiles RLS requires
-- authentication (TO authenticated) for SELECT.
--
-- Solution: A SECURITY DEFINER function that safely returns only
-- the email for a given admission_number or username. This is safe
-- because it only exposes the email field, not sensitive data.
-- ============================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_email_by_identifier(TEXT, TEXT);

-- Create a SECURITY DEFINER function accessible by anonymous users
-- that returns only the email for login purposes
CREATE OR REPLACE FUNCTION public.get_email_by_identifier(
  p_identifier TEXT,
  p_type TEXT  -- 'admission_number' or 'username'
)
RETURNS TABLE(email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type = 'admission_number' THEN
    RETURN QUERY
      SELECT p.email
      FROM public.profiles p
      WHERE UPPER(p.admission_number) = UPPER(p_identifier)
        AND p.role = 'student'
      LIMIT 1;
  ELSIF p_type = 'username' THEN
    RETURN QUERY
      SELECT p.email
      FROM public.profiles p
      WHERE LOWER(p.username) = LOWER(p_identifier)
        AND p.role = 'student'
      LIMIT 1;
  END IF;
END;
$$;

-- Allow anonymous (unauthenticated) users to call this function
GRANT EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT, TEXT) TO authenticated;

-- ============================================================
-- ALSO: Ensure the anon role can read minimal profile fields
-- for the login lookup (alternative approach using a permissive policy)
-- 
-- If you prefer RLS policies over a function, you can instead add:
-- ============================================================

-- Option B (alternative to the function above — pick ONE approach):
-- Allow anonymous reads of ONLY the email/admission_number/username fields
-- This is less preferred since it exposes more data to unauthenticated requests.
-- Uncomment if you don't want to use the SECURITY DEFINER function:

-- DROP POLICY IF EXISTS "profiles_anon_login_lookup" ON public.profiles;
-- CREATE POLICY "profiles_anon_login_lookup" ON public.profiles
--   FOR SELECT TO anon
--   USING (TRUE);  -- Only safe if profiles don't contain sensitive PII beyond email
