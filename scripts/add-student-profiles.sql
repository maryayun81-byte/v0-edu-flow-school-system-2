-- ========================================
-- EduFlow: Student Profiles & Admission System
-- ========================================

-- Add role column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'teacher';
  END IF;
END $$;

-- Add student-specific columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'admission_number') THEN
    ALTER TABLE profiles ADD COLUMN admission_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'school_name') THEN
    ALTER TABLE profiles ADD COLUMN school_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'form_class') THEN
    ALTER TABLE profiles ADD COLUMN form_class TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subjects') THEN
    ALTER TABLE profiles ADD COLUMN subjects JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile_completed') THEN
    ALTER TABLE profiles ADD COLUMN profile_completed BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'date_of_birth') THEN
    ALTER TABLE profiles ADD COLUMN date_of_birth DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'guardian_name') THEN
    ALTER TABLE profiles ADD COLUMN guardian_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'guardian_phone') THEN
    ALTER TABLE profiles ADD COLUMN guardian_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
    ALTER TABLE profiles ADD COLUMN address TEXT;
  END IF;
END $$;

-- Create classes table for teacher-class assignments
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  form_level TEXT NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teacher_classes junction table
CREATE TABLE IF NOT EXISTS teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subjects JSONB DEFAULT '[]',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(teacher_id, class_id)
);

-- Create student_classes junction table
CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- Create subjects reference table
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

-- Enable RLS on new tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;
DROP POLICY IF EXISTS "Everyone can view teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Admins can manage teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Students can view their enrollments" ON student_classes;
DROP POLICY IF EXISTS "Admins can manage student enrollments" ON student_classes;
DROP POLICY IF EXISTS "Everyone can view subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON subjects;

-- Classes Policies
CREATE POLICY "Everyone can view classes"
  ON classes FOR SELECT USING (true);

CREATE POLICY "Admins can manage classes"
  ON classes FOR INSERT
  USING (true);

CREATE POLICY "Admins can update classes"
  ON classes FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete classes"
  ON classes FOR DELETE
  USING (true);

-- Teacher Classes Policies
CREATE POLICY "Everyone can view teacher assignments"
  ON teacher_classes FOR SELECT USING (true);

CREATE POLICY "Admins can insert teacher assignments"
  ON teacher_classes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update teacher assignments"
  ON teacher_classes FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete teacher assignments"
  ON teacher_classes FOR DELETE
  USING (true);

-- Student Classes Policies
CREATE POLICY "Everyone can view student enrollments"
  ON student_classes FOR SELECT USING (true);

CREATE POLICY "Admins can insert student enrollments"
  ON student_classes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update student enrollments"
  ON student_classes FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete student enrollments"
  ON student_classes FOR DELETE
  USING (true);

-- Subjects Policies
CREATE POLICY "Everyone can view subjects"
  ON subjects FOR SELECT USING (true);

CREATE POLICY "Admins can insert subjects"
  ON subjects FOR INSERT
  WITH CHECK (true);
