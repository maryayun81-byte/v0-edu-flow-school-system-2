-- Fix for missing 'audience' column in notifications table

-- Add audience column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'audience') THEN
        ALTER TABLE notifications ADD COLUMN audience TEXT DEFAULT 'all';
    END IF;
END $$;

-- Verify or Add target_user_id if missing (just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'target_user_id') THEN
        ALTER TABLE notifications ADD COLUMN target_user_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Verify created_by existence
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'created_by') THEN
        ALTER TABLE notifications ADD COLUMN created_by UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Make sure RLS enables reading for target users
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts before recreating
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;

-- Create comprehensive policy
CREATE POLICY "Users can view their notifications"
ON notifications
FOR SELECT
USING (
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
