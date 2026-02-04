-- Notification Reads Table Setup
-- This table tracks which users have read which notifications

-- Create notification_reads table
CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);

-- Enable RLS
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own read status" ON notification_reads;
DROP POLICY IF EXISTS "Users can insert their own read status" ON notification_reads;
DROP POLICY IF EXISTS "Users can delete their own read status" ON notification_reads;

-- Policy 1: Users can view their own read status
CREATE POLICY "Users can view their own read status"
ON notification_reads FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Users can insert their own read status
CREATE POLICY "Users can insert their own read status"
ON notification_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy 3: Users can delete their own read status
CREATE POLICY "Users can delete their own read status"
ON notification_reads FOR DELETE
USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON notification_reads TO authenticated;

-- Create function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Get profile role
  SELECT COUNT(DISTINCT n.id) INTO v_count
  FROM notifications n
  LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = p_user_id
  WHERE nr.id IS NULL
  AND (
    n.audience = 'all'
    OR (n.audience = 'student' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'student'
    ))
    OR (n.audience = 'teacher' AND EXISTS (
      SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'teacher'
    ))
    OR (n.audience = 'individual' AND n.target_user_id = p_user_id)
  );
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_unread_notification_count(UUID) TO authenticated;
