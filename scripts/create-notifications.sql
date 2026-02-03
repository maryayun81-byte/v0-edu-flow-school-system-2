-- Create notifications table for real-time notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('note', 'assignment', 'timetable', 'quiz', 'class', 'general', 'activity')),
  title TEXT NOT NULL,
  message TEXT,
  description TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing table if needed
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create dashboard_activity table for anonymous tracking
CREATE TABLE IF NOT EXISTS dashboard_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal TEXT NOT NULL DEFAULT 'student',
  action TEXT NOT NULL DEFAULT 'access',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_activity ENABLE ROW LEVEL SECURITY;

-- Everyone can view notifications (students don't have accounts)
DROP POLICY IF EXISTS "Everyone can view notifications" ON notifications;
CREATE POLICY "Everyone can view notifications" ON notifications FOR SELECT USING (true);

-- Authenticated users can create notifications
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Everyone can view and insert activity
DROP POLICY IF EXISTS "Everyone can view activity" ON dashboard_activity;
CREATE POLICY "Everyone can view activity" ON dashboard_activity FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can insert activity" ON dashboard_activity;
CREATE POLICY "Everyone can insert activity" ON dashboard_activity FOR INSERT WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_activity;
