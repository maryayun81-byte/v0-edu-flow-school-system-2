-- ========================================
-- EduFlow Complete Database Setup
-- Run this script to initialize the entire database
-- ========================================

-- ========================================
-- 1. PROFILES TABLE (User profiles for all roles)
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

-- ========================================
-- 2. CLASSES AND ASSOCIATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  form_level TEXT NOT NULL,
  year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subjects JSONB DEFAULT '[]',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- ========================================
-- 3. SUBJECTS REFERENCE TABLE
-- ========================================
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
-- 4. NOTES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_path TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 5. ASSIGNMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  github_repo_link TEXT,
  is_archived BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 6. TIMETABLES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject TEXT,
  class_date DATE,
  is_online BOOLEAN DEFAULT false,
  meeting_link TEXT,
  meeting_id TEXT,
  meeting_password TEXT,
  location TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. QUIZZES SYSTEM
-- ========================================
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER DEFAULT 30,
  points_per_question INTEGER DEFAULT 10,
  is_published BOOLEAN DEFAULT false,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  allow_retake BOOLEAN DEFAULT false,
  shuffle_questions BOOLEAN DEFAULT true,
  show_correct_answers BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 10,
  order_index INTEGER DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT,
  score INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT false,
  answers JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 8. LEADERBOARD
-- ========================================
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  student_email TEXT UNIQUE,
  total_points INTEGER DEFAULT 0,
  quizzes_completed INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  badges JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 9. NOTIFICATIONS
-- ========================================
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

-- ========================================
-- 10. INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_admission ON profiles(admission_number);
CREATE INDEX IF NOT EXISTS idx_profiles_form_class ON profiles(form_class);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class ON teacher_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_student ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class ON student_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_created_by ON assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_archived ON assignments(is_archived);
CREATE INDEX IF NOT EXISTS idx_timetables_created_by ON timetables(created_by);
CREATE INDEX IF NOT EXISTS idx_timetables_day ON timetables(day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetables_class_date ON timetables(class_date);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_published ON quizzes(is_published);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_points ON leaderboard(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ========================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 12. RLS POLICIES
-- ========================================

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Classes Policies
DROP POLICY IF EXISTS "Everyone can view classes" ON classes;
DROP POLICY IF EXISTS "Authenticated users can manage classes" ON classes;

CREATE POLICY "Everyone can view classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage classes" ON classes FOR ALL USING (auth.uid() IS NOT NULL);

-- Teacher Classes Policies
DROP POLICY IF EXISTS "Everyone can view teacher assignments" ON teacher_classes;
DROP POLICY IF EXISTS "Authenticated users can manage teacher assignments" ON teacher_classes;

CREATE POLICY "Everyone can view teacher assignments" ON teacher_classes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage teacher assignments" ON teacher_classes FOR ALL USING (auth.uid() IS NOT NULL);

-- Student Classes Policies
DROP POLICY IF EXISTS "Everyone can view student enrollments" ON student_classes;
DROP POLICY IF EXISTS "Authenticated users can manage student enrollments" ON student_classes;

CREATE POLICY "Everyone can view student enrollments" ON student_classes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage student enrollments" ON student_classes FOR ALL USING (auth.uid() IS NOT NULL);

-- Subjects Policies
DROP POLICY IF EXISTS "Everyone can view subjects" ON subjects;
CREATE POLICY "Everyone can view subjects" ON subjects FOR SELECT USING (true);

-- Notes Policies
DROP POLICY IF EXISTS "Everyone can view notes" ON notes;
DROP POLICY IF EXISTS "Teachers can manage their notes" ON notes;

CREATE POLICY "Everyone can view notes" ON notes FOR SELECT USING (true);
CREATE POLICY "Teachers can manage their notes" ON notes FOR ALL USING (created_by = auth.uid());

-- Assignments Policies
DROP POLICY IF EXISTS "Everyone can view assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can manage their assignments" ON assignments;

CREATE POLICY "Everyone can view assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Teachers can manage their assignments" ON assignments FOR ALL USING (created_by = auth.uid());

-- Timetables Policies
DROP POLICY IF EXISTS "Everyone can view timetables" ON timetables;
DROP POLICY IF EXISTS "Teachers can manage their timetables" ON timetables;

CREATE POLICY "Everyone can view timetables" ON timetables FOR SELECT USING (true);
CREATE POLICY "Teachers can manage their timetables" ON timetables FOR ALL USING (created_by = auth.uid());

-- Quizzes Policies
DROP POLICY IF EXISTS "Everyone can view published quizzes" ON quizzes;
DROP POLICY IF EXISTS "Teachers can manage their quizzes" ON quizzes;

CREATE POLICY "Everyone can view published quizzes" ON quizzes FOR SELECT USING (is_published = true OR created_by = auth.uid());
CREATE POLICY "Teachers can manage their quizzes" ON quizzes FOR ALL USING (created_by = auth.uid());

-- Quiz Questions Policies
DROP POLICY IF EXISTS "Everyone can view quiz questions" ON quiz_questions;
DROP POLICY IF EXISTS "Teachers can manage quiz questions" ON quiz_questions;

CREATE POLICY "Everyone can view quiz questions" ON quiz_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND (quizzes.is_published = true OR quizzes.created_by = auth.uid()))
);
CREATE POLICY "Teachers can manage quiz questions" ON quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.created_by = auth.uid())
);

-- Quiz Attempts Policies
DROP POLICY IF EXISTS "Anyone can manage quiz attempts" ON quiz_attempts;
CREATE POLICY "Anyone can manage quiz attempts" ON quiz_attempts FOR ALL USING (true);

-- Leaderboard Policies
DROP POLICY IF EXISTS "Anyone can manage leaderboard" ON leaderboard;
CREATE POLICY "Anyone can manage leaderboard" ON leaderboard FOR ALL USING (true);

-- Notifications Policies
DROP POLICY IF EXISTS "Anyone can view notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can manage notifications" ON notifications;

CREATE POLICY "Anyone can view notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Anyone can manage notifications" ON notifications FOR ALL USING (true);

-- ========================================
-- 13. ENABLE REALTIME
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE timetables;
ALTER PUBLICATION supabase_realtime ADD TABLE quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
