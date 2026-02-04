-- Enhanced Notifications System with Broadcasting and Priority
-- This script updates the notifications table to support premium features

-- Add new columns to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS broadcast BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Rename is_read to read if it exists (for consistency)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN is_read TO read;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(broadcast) WHERE broadcast = TRUE;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE read = FALSE;

-- Update RLS policies for targeted notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" ON notifications 
  FOR SELECT 
  USING (
    broadcast = TRUE OR 
    recipient_id = auth.uid() OR 
    recipient_id IS NULL
  );

-- Policy for creating notifications (teachers and admins)
DROP POLICY IF EXISTS "Teachers and admins can create notifications" ON notifications;
CREATE POLICY "Teachers and admins can create notifications" ON notifications 
  FOR INSERT 
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (
        raw_user_meta_data->>'role' = 'teacher' OR 
        raw_user_meta_data->>'role' = 'admin'
      )
    )
  );

-- Policy for updating notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications" ON notifications 
  FOR UPDATE 
  USING (recipient_id = auth.uid() OR broadcast = TRUE)
  WITH CHECK (recipient_id = auth.uid() OR broadcast = TRUE);

-- Function to update read_at timestamp
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read = TRUE AND OLD.read = FALSE THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for read_at timestamp
DROP TRIGGER IF EXISTS notification_read_at_trigger ON notifications;
CREATE TRIGGER notification_read_at_trigger
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  WHEN (OLD.read IS DISTINCT FROM NEW.read)
  EXECUTE FUNCTION update_notification_read_at();

-- Enable realtime for notifications (skip if already added)
DO $$ 
BEGIN
  -- Try to add the table to realtime publication
  -- If it's already there, this will be caught and ignored
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION 
    WHEN duplicate_object THEN
      -- Table is already in the publication, which is fine
      RAISE NOTICE 'notifications table is already enabled for realtime';
  END;
END $$;
