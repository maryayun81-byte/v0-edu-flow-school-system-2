-- Fix RLS policies to allow students to view content

-- Drop conflicting policies on notes
DROP POLICY IF EXISTS "Users can read their notes" ON notes;
DROP POLICY IF EXISTS "Everyone can view notes" ON notes;

-- Create proper public read policy for notes
CREATE POLICY "Everyone can view notes" ON notes
  FOR SELECT USING (true);

-- Drop conflicting policies on assignments  
DROP POLICY IF EXISTS "Users can read their assignments" ON assignments;
DROP POLICY IF EXISTS "Everyone can view assignments" ON assignments;

-- Create proper public read policy for assignments
CREATE POLICY "Everyone can view assignments" ON assignments
  FOR SELECT USING (true);

-- Drop conflicting policies on timetables
DROP POLICY IF EXISTS "Users can read their timetables" ON timetables;
DROP POLICY IF EXISTS "Everyone can view timetables" ON timetables;

-- Create proper public read policy for timetables
CREATE POLICY "Everyone can view timetables" ON timetables
  FOR SELECT USING (true);

-- Add is_archived column to notes if not exists
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
