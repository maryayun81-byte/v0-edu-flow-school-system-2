-- Add new columns to timetables table for online classes and date-based scheduling

ALTER TABLE timetables 
ADD COLUMN IF NOT EXISTS class_date DATE,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS meeting_id TEXT,
ADD COLUMN IF NOT EXISTS meeting_password TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;
