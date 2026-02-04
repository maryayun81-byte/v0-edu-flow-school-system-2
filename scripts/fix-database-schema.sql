-- ========================================
-- EduFlow: Complete Database Schema Fix
-- This script ensures all required tables and columns exist
-- Run this in Supabase SQL Editor to fix authentication issues
-- ========================================

-- ========================================
-- 1. CREATE PROFILES TABLE WITH ALL COLUMNS
-- ========================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  
  -- Student-specific columns
  admission_number TEXT UNIQUE,
  username TEXT UNIQUE,
  school_name TEXT,
  form_class TEXT,
  subjects JSONB DEFAULT '[]',
  profile_completed BOOLEAN DEFAULT false,
  date_of_birth DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  address TEXT,
  theme TEXT DEFAULT 'dark',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. ADD MISSING COLUMNS (IF TABLE ALREADY EXISTS)
-- ========================================

-- Add columns that might be missing from existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admission_number TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_class TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- ========================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_admission_number ON profiles(admission_number);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_form_class ON profiles(form_class);

-- ========================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 5. DROP ALL EXISTING CONFLICTING POLICIES
-- ========================================

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON profiles;

-- ========================================
-- 6. CREATE CORRECT RLS POLICIES
-- ========================================

-- Allow all authenticated users to view all profiles
-- (Needed for teachers to see students, students to see teachers, etc.)
CREATE POLICY "Anyone can view all profiles"
  ON profiles FOR SELECT
  USING (true);

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ========================================
-- 7. CREATE SUPPORTING TABLES
-- ========================================

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  form_level TEXT NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teacher-Class assignments
CREATE TABLE IF NOT EXISTS teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subjects JSONB DEFAULT '[]',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(teacher_id, class_id)
);

-- Student-Class enrollments
CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- Subjects reference table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_core BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default subjects
INSERT INTO subjects (name, code, is_core) VALUES
  ('Mathematics', 'MATH', true),
  ('English', 'ENG', true),
  ('Kiswahili', 'KIS', true),
  ('Physics', 'PHY', false),
  ('Chemistry', 'CHEM', false),
  ('Biology', 'BIO', false),
  ('History', 'HIST', false),
  ('Geography', 'GEO', false),
  ('Computer Studies', 'CS', false),
  ('Business Studies', 'BUS', false),
  ('Agriculture', 'AGRI', false),
  ('Religious Education', 'RE', false)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- 8. ENABLE RLS ON SUPPORTING TABLES
-- ========================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 9. CREATE POLICIES FOR SUPPORTING TABLES
-- ========================================

-- Classes policies
DROP POLICY IF EXISTS "Everyone can view classes" ON classes;
DROP POLICY IF EXISTS "Authenticated users can manage classes" ON classes;

CREATE POLICY "Everyone can view classes"
  ON classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage classes"
  ON classes FOR ALL USING (auth.uid() IS NOT NULL);

-- Teacher classes policies
DROP POLICY IF EXISTS "Everyone can view teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Authenticated users can manage teacher assignments" ON teacher_classes;

CREATE POLICY "Everyone can view teacher assignments"
  ON teacher_classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage teacher assignments"
  ON teacher_classes FOR ALL USING (auth.uid() IS NOT NULL);

-- Student classes policies
DROP POLICY IF EXISTS "Everyone can view student enrollments" ON student_classes;
DROP POLICY IF EXISTS "Authenticated users can manage student enrollments" ON student_classes;

CREATE POLICY "Everyone can view student enrollments"
  ON student_classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage student enrollments"
  ON student_classes FOR ALL USING (auth.uid() IS NOT NULL);

-- Subjects policies
DROP POLICY IF EXISTS "Everyone can view subjects" ON subjects;

CREATE POLICY "Everyone can view subjects"
  ON subjects FOR SELECT USING (true);

-- ========================================
-- 10. CREATE INDEXES FOR SUPPORTING TABLES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class ON teacher_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_student ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class ON student_classes(class_id);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Run these queries after executing this script to verify everything is set up correctly:

-- 1. Check profiles table structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- ORDER BY ordinal_position;

-- 2. Check RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'profiles';

-- 3. Check indexes
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'profiles';
