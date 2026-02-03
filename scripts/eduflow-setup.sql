-- ========================================
-- EduFlow Complete Setup Script
-- ========================================

-- 1. Create profiles table first (required for other tables)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'teacher',
  admission_number TEXT UNIQUE,
  school_name TEXT,
  form_class TEXT,
  subjects JSONB DEFAULT '[]',
  profile_completed BOOLEAN DEFAULT false,
  date_of_birth DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  form_level TEXT NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create teacher_classes junction table
CREATE TABLE IF NOT EXISTS teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subjects JSONB DEFAULT '[]',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(teacher_id, class_id)
);

-- 4. Create student_classes junction table
CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- 5. Create subjects reference table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_core BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insert default subjects
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

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_admission ON profiles(admission_number);
CREATE INDEX IF NOT EXISTS idx_profiles_form_class ON profiles(form_class);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class ON teacher_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_student ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class ON student_classes(class_id);

-- 8. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- 9. Profiles Policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- 10. Classes Policies
DROP POLICY IF EXISTS "Everyone can view classes" ON classes;
DROP POLICY IF EXISTS "Authenticated users can insert classes" ON classes;
DROP POLICY IF EXISTS "Authenticated users can update classes" ON classes;
DROP POLICY IF EXISTS "Authenticated users can delete classes" ON classes;

CREATE POLICY "Everyone can view classes"
  ON classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert classes"
  ON classes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update classes"
  ON classes FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete classes"
  ON classes FOR DELETE USING (auth.uid() IS NOT NULL);

-- 11. Teacher Classes Policies
DROP POLICY IF EXISTS "Everyone can view teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Authenticated users can insert teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Authenticated users can update teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Authenticated users can delete teacher assignments" ON teacher_classes;

CREATE POLICY "Everyone can view teacher assignments"
  ON teacher_classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert teacher assignments"
  ON teacher_classes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update teacher assignments"
  ON teacher_classes FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete teacher assignments"
  ON teacher_classes FOR DELETE USING (auth.uid() IS NOT NULL);

-- 12. Student Classes Policies
DROP POLICY IF EXISTS "Everyone can view student enrollments" ON student_classes;
DROP POLICY IF EXISTS "Authenticated users can insert student enrollments" ON student_classes;
DROP POLICY IF EXISTS "Authenticated users can update student enrollments" ON student_classes;
DROP POLICY IF EXISTS "Authenticated users can delete student enrollments" ON student_classes;

CREATE POLICY "Everyone can view student enrollments"
  ON student_classes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert student enrollments"
  ON student_classes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update student enrollments"
  ON student_classes FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete student enrollments"
  ON student_classes FOR DELETE USING (auth.uid() IS NOT NULL);

-- 13. Subjects Policies
DROP POLICY IF EXISTS "Everyone can view subjects" ON subjects;
DROP POLICY IF EXISTS "Authenticated users can insert subjects" ON subjects;

CREATE POLICY "Everyone can view subjects"
  ON subjects FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert subjects"
  ON subjects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
