-- Aggressively clean up ALL potential legacy policies to remove 'auth.users' dependency
DO $$
BEGIN
    -- Drop policies from create-notifications-table.sql
    DROP POLICY IF EXISTS "Teachers and admins can create notifications" ON notifications;
    DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
    
    -- Drop policies from create-notification-system.sql
    DROP POLICY IF EXISTS "Admins can do everything on notifications" ON notifications;
    
    -- Drop my previous attempts if any
    DROP POLICY IF EXISTS "Admins can manage all notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
END $$;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. Admin Policy: Full Access (based on public.profiles)
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

-- 2. Teacher Policy: Can Create (but not delete others)
CREATE POLICY "Teachers can create notifications"
ON notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- 3. Read Policy: Everyone can see their own notifications
CREATE POLICY "Users can view their notifications"
ON notifications
FOR SELECT
USING (
  -- Admins see all
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  OR
  -- Public/Broadcast
  audience = 'all'
  OR
  -- Role-based
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
  -- Individual
  (audience = 'individual' AND target_user_id = auth.uid())
);

-- 4. Update Policy: Users can mark as read (if using a flag on this table, though we use notification_reads table usually)
-- Just in case the frontend tries to update the 'read' column on this table directly:
CREATE POLICY "Users can update own read status"
ON notifications
FOR UPDATE
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid());

-- Grant essential permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;
