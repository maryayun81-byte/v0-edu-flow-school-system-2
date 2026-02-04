-- Enable RLS on notifications (ensure it's on)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Admins to do EVERYTHING (Insert, Update, Delete, Select)
-- We check if the current user has the 'admin' role in the profiles table.
CREATE POLICY "Admins can manage all notifications"
ON notifications
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 2. Policy for users to READ their own notifications
-- (Re-applying this to be safe, ensuring no conflict with the admin policy)
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;

CREATE POLICY "Users can view their notifications"
ON notifications
FOR SELECT
USING (
  -- Admins can see everything (covered above, but good for completeness in SELECT)
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  OR
  -- Public/All notifications
  audience = 'all'
  OR
  -- Role-based notifications
  (audience = 'student' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'student'
  ))
  OR
  (audience = 'teacher' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
  ))
  OR
  -- Individual notifications
  (audience = 'individual' AND target_user_id = auth.uid())
);

-- 3. Fix "permission denied for table users" error
-- Sometimes Supabase's realtime or auth checks trip up if public access isn't clear.
-- We grant basic access to the public role for these operations if they are authenticated.
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;
