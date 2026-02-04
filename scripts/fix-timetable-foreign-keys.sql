-- =====================================================
-- FIX TIMETABLE FOREIGN KEY RELATIONSHIPS
-- =====================================================
-- This script adds a helper function to fetch teacher names
-- and updates RLS policies to allow proper data access
-- =====================================================

-- =====================================================
-- PART 1: CREATE HELPER FUNCTION TO GET TEACHER NAMES
-- =====================================================

-- Function to get teacher full name by user ID
CREATE OR REPLACE FUNCTION get_teacher_name(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  teacher_name TEXT;
BEGIN
  SELECT p.full_name INTO teacher_name
  FROM profiles p
  WHERE p.id = user_id;
  
  RETURN COALESCE(teacher_name, 'Unknown Teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_teacher_name(UUID) TO authenticated;

-- =====================================================
-- PART 2: UPDATE RLS POLICIES FOR PROFILES
-- =====================================================

-- Allow users to view other profiles (needed for teacher names in timetable)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

-- Keep existing insert/update policies restrictive
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- =====================================================
-- PART 3: CREATE VIEW FOR TIMETABLE WITH TEACHER NAMES
-- =====================================================

-- Create a view that includes teacher and class names
CREATE OR REPLACE VIEW timetable_sessions_with_details AS
SELECT 
  ts.*,
  p.full_name as teacher_name,
  c.name as class_name
FROM timetable_sessions ts
LEFT JOIN profiles p ON ts.teacher_id = p.id
LEFT JOIN classes c ON ts.class_id = c.id;

-- Grant select permission on the view
GRANT SELECT ON timetable_sessions_with_details TO authenticated;

-- =====================================================
-- PART 4: VERIFICATION
-- =====================================================

-- Test the helper function
SELECT 
  'Testing get_teacher_name function' as test,
  get_teacher_name(id) as teacher_name
FROM profiles
WHERE role = 'teacher'
LIMIT 3;

-- Verify the view
SELECT 
  'Testing timetable_sessions_with_details view' as test,
  COUNT(*) as session_count
FROM timetable_sessions_with_details;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 
  '✅ Timetable foreign key fixes applied successfully!' as message,
  'Helper function: get_teacher_name(UUID)' as function_created,
  'View: timetable_sessions_with_details' as view_created,
  'RLS policies updated for profiles table' as security_update;
