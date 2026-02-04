-- Create Notifications Table
-- This script creates the notifications table from scratch with all premium features

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  broadcast BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(broadcast) WHERE broadcast = TRUE;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their notifications or broadcast notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" ON notifications 
  FOR SELECT 
  USING (
    broadcast = TRUE OR 
    recipient_id = auth.uid() OR 
    recipient_id IS NULL
  );

-- RLS Policy: Teachers and admins can create notifications
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

-- RLS Policy: Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications" ON notifications 
  FOR UPDATE 
  USING (recipient_id = auth.uid() OR broadcast = TRUE)
  WITH CHECK (recipient_id = auth.uid() OR broadcast = TRUE);

-- RLS Policy: Admins can delete notifications
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete notifications" ON notifications 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at timestamp
DROP TRIGGER IF EXISTS notification_updated_at_trigger ON notifications;
CREATE TRIGGER notification_updated_at_trigger
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

-- Enable realtime for notifications (skip if already added)
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION 
    WHEN duplicate_object THEN
      RAISE NOTICE 'notifications table is already enabled for realtime';
  END;
END $$;

-- Insert sample notifications for testing (optional)
-- Uncomment the lines below if you want to test with sample data

-- INSERT INTO notifications (type, title, message, priority, broadcast) VALUES
-- ('announcement', 'Welcome to Peak Performance Tutoring', 'We are excited to have you on board!', 'high', true),
-- ('system', 'System Maintenance', 'Scheduled maintenance on Sunday at 2 AM', 'medium', true);

COMMENT ON TABLE notifications IS 'Stores all notifications for students, teachers, and admins with support for broadcasting and priority levels';
