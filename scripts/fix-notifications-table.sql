-- ============================================
-- Fix Notifications Table - Add Missing Columns
-- Run this in Supabase SQL Editor
-- ============================================

-- Add target_audience column (array of roles)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS target_audience TEXT[] DEFAULT '{}';

-- Add target_user_id column (for user-specific notifications)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for target_user_id for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON notifications(target_user_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Notifications table has been updated with target_audience and target_user_id columns!';
END $$;
