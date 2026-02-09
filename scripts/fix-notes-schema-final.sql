-- Comprehensive fix for the 'notes' table
-- Run this in Supabase SQL Editor to ensure ALL columns exist

-- 1. Create table if it doesn't exist (with base structure)
CREATE TABLE IF NOT EXISTS notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    title text NOT NULL,
    description text
);

-- 2. Add all potentially missing columns safely
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_path text,
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_class_id ON notes(class_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject_id ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);

-- 4. Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies (Drop first to avoid duplication/errors)
DROP POLICY IF EXISTS "Notes are viewable by everyone" ON notes;
DROP POLICY IF EXISTS "Teachers can insert notes" ON notes;
DROP POLICY IF EXISTS "Teachers can update their own notes" ON notes;
DROP POLICY IF EXISTS "Teachers can delete their own notes" ON notes;

-- Allow read access to authenticated users (students and teachers)
CREATE POLICY "Authenticated users can view notes"
ON notes FOR SELECT
TO authenticated
USING (true);

-- Allow insert access to teachers
CREATE POLICY "Teachers can insert notes"
ON notes FOR INSERT
TO authenticated
WITH CHECK (true); -- Ideally restrict to role='teacher' if possible, or trust app logic

-- Allow update/delete for creator
CREATE POLICY "Users can update own notes"
ON notes FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own notes"
ON notes FOR DELETE
TO authenticated
USING (auth.uid() = created_by);
