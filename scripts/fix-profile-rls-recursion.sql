-- Fix Infinite Recursion in Profiles RLS
-- The previous policies caused a loop because checking if a user is an admin required querying the profiles table, 
-- which triggered the policy again.

-- 1. Create a SECURITY DEFINER function to check admin status without triggering RLS
-- SECURITY DEFINER means this function runs with the privileges of the creator (superuser), bypassing RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update user roles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- 3. Re-create policies using the safe is_admin() function

-- Policy: Admins can VIEW all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  is_admin() OR auth.uid() = id -- Admins see all, Users see themselves (redundant if another policy exists, but safe here)
);

-- Policy: Admins can UPDATE roles
CREATE POLICY "Admins can update user roles"
ON profiles FOR UPDATE
TO authenticated
USING (
  is_admin()
)
WITH CHECK (
  is_admin()
);

-- Policy: Admins can DELETE profiles
CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  is_admin()
);

-- Ensure basic user policy exists (if it implies recursion elsewhere, though usually id=auth.uid() is safe)
-- We won't touch other policies unless needed, but we explicitly handled "Users see themselves" in the generic select above just in case.
