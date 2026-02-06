-- Enable Admin Role Management
-- Allows admins to view all profiles and update roles

-- 1. Ensure RLS is enabled on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Admins can VIEW all profiles (to search for users to promote)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- 3. Policy: Admins can UPDATE roles
-- Note: verification is critical here. Only allow updating the 'role' column effectively.
-- Ideally, we'd use a stored procedure for safety, but RLS on UPDATE works if we trust admins.
DROP POLICY IF EXISTS "Admins can update user roles" ON profiles;
CREATE POLICY "Admins can update user roles"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
)
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- 4. Policy: Admins can DELETE profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- 4. Helper Function to toggle admin role safely (Optional but recommended for client simplicity)
CREATE OR REPLACE FUNCTION toggle_admin_role(target_user_id UUID, make_admin BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as superuser to bypass RLS complexity in simple calls if needed, but RLS above handles it.
AS $$
DECLARE
  current_user_role TEXT;
  target_user_exists BOOLEAN;
BEGIN
  -- Check if executor is admin
  SELECT role INTO current_user_role FROM profiles WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can manage roles';
  END IF;

  -- Update target
  UPDATE profiles 
  SET role = CASE WHEN make_admin THEN 'admin' ELSE 'student' END -- Default fallback to student, or we could pass the target role
  WHERE id = target_user_id;
  
  -- If revoking, we might want to default to 'teacher' if they were a teacher? 
  -- For now, let's just assume we toggle Admin <-> Student or just handle the update directly from client with the policy.
  -- Actually, let's stick to the RLS + Client Update approach for flexibility, this function is just a backup.
  
  RETURN jsonb_build_object('success', true);
END;
$$;
