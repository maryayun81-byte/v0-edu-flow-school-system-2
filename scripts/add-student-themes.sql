-- Add username, theme, and email columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create indexes for lookups (for login by username or admission number)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_admission_number ON profiles(admission_number);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- The application handles login by looking up the profile first, then authenticating
-- This allows students to log in with:
-- 1. Email address (if they have one)
-- 2. Username (if they set one)
-- 3. Admission number (always available)
