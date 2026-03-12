-- scripts/add_teacher_indices.sql

-- Add indices to optimize teacher queries for the new Teachers Tab filtering and pagination

-- 1. Index on the 'role' column in profiles to quickly filter teachers vs students
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. Index on 'subject' column in profiles to quickly filter teachers by subject
CREATE INDEX IF NOT EXISTS idx_profiles_subject ON profiles(subject);

-- 3. Index on teacher_classes to quickly find which teacher teaches which class
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher_id ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class_id ON teacher_classes(class_id);

-- Optional: index on created_at for pagination sorting
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_assigned_at ON teacher_classes(assigned_at DESC);
