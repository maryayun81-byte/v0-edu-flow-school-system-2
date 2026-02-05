-- ============================================
-- Teacher Subject Preferences System
-- Run this in Supabase SQL Editor
-- ============================================

-- Create teacher_subject_preferences table
CREATE TABLE IF NOT EXISTS teacher_subject_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  preferred_classes TEXT[] DEFAULT '{}', -- Array of class levels they prefer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, subject)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teacher_subject_prefs_teacher ON teacher_subject_preferences(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subject_prefs_subject ON teacher_subject_preferences(subject);

-- Enable RLS
ALTER TABLE teacher_subject_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Teachers can view own preferences" ON teacher_subject_preferences;
CREATE POLICY "Teachers can view own preferences" ON teacher_subject_preferences
  FOR SELECT USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can insert own preferences" ON teacher_subject_preferences;
CREATE POLICY "Teachers can insert own preferences" ON teacher_subject_preferences
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can update own preferences" ON teacher_subject_preferences;
CREATE POLICY "Teachers can update own preferences" ON teacher_subject_preferences
  FOR UPDATE USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can delete own preferences" ON teacher_subject_preferences;
CREATE POLICY "Teachers can delete own preferences" ON teacher_subject_preferences
  FOR DELETE USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all preferences" ON teacher_subject_preferences;
CREATE POLICY "Admins can view all preferences" ON teacher_subject_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add onboarding_completed column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Teacher subject preferences system created successfully!';
END $$;
