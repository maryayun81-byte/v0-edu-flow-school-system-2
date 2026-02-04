-- =====================================================
-- Messaging System Participant Resolution Functions
-- =====================================================
-- This script creates database functions to determine
-- who can message whom based on class assignments,
-- subject enrollments, and role-based rules.
-- =====================================================

-- Function: Get students a teacher can message
-- Returns students in classes the teacher teaches
CREATE OR REPLACE FUNCTION get_teacher_messageable_students(teacher_id UUID)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  student_class TEXT,
  shared_subjects TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.full_name,
    p.form_class,
    ARRAY_AGG(DISTINCT unnest(tc.subjects)) as shared_subjects
  FROM profiles p
  CROSS JOIN teacher_classes tc
  JOIN classes c ON c.id = tc.class_id
  WHERE p.role = 'student'
    AND tc.teacher_id = get_teacher_messageable_students.teacher_id
    AND p.form_class = c.name
    AND p.subjects && tc.subjects  -- Array overlap operator
  GROUP BY p.id, p.full_name, p.form_class;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get teachers a student can message
-- Returns teachers who teach the student's subjects in their class
CREATE OR REPLACE FUNCTION get_student_messageable_teachers(student_id UUID)
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  teacher_subject TEXT,
  teaches_in_class BOOLEAN
) AS $$
DECLARE
  student_class TEXT;
  student_subjects TEXT[];
BEGIN
  -- Get student's class and subjects
  SELECT form_class, subjects INTO student_class, student_subjects
  FROM profiles WHERE id = get_student_messageable_teachers.student_id;
  
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.full_name,
    p.subject,
    TRUE as teaches_in_class
  FROM profiles p
  JOIN teacher_classes tc ON tc.teacher_id = p.id
  JOIN classes c ON c.id = tc.class_id
  WHERE p.role = 'teacher'
    AND c.name = student_class
    AND tc.subjects && student_subjects;  -- Array overlap operator
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get classmates a student can message
-- Returns students in the same class with shared subjects
CREATE OR REPLACE FUNCTION get_student_messageable_classmates(student_id UUID)
RETURNS TABLE (
  classmate_id UUID,
  classmate_name TEXT,
  shared_subjects TEXT[]
) AS $$
DECLARE
  student_class TEXT;
  student_subjects TEXT[];
BEGIN
  SELECT form_class, subjects INTO student_class, student_subjects
  FROM profiles WHERE id = get_student_messageable_classmates.student_id;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    ARRAY(
      SELECT unnest(p.subjects)
      INTERSECT
      SELECT unnest(student_subjects)
    ) as shared_subjects
  FROM profiles p
  WHERE p.role = 'student'
    AND p.id != get_student_messageable_classmates.student_id
    AND p.form_class = student_class
    AND p.subjects && student_subjects;  -- Must have at least one shared subject
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if messaging is allowed between two users
CREATE OR REPLACE FUNCTION can_message(sender_id UUID, recipient_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sender_role TEXT;
  recipient_role TEXT;
BEGIN
  SELECT role INTO sender_role FROM profiles WHERE id = can_message.sender_id;
  SELECT role INTO recipient_role FROM profiles WHERE id = can_message.recipient_id;
  
  -- Admin can message anyone
  IF sender_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Teacher to student (check if teacher teaches student)
  IF sender_role = 'teacher' AND recipient_role = 'student' THEN
    RETURN EXISTS (
      SELECT 1 FROM get_teacher_messageable_students(can_message.sender_id)
      WHERE student_id = can_message.recipient_id
    );
  END IF;
  
  -- Student to teacher (check if teacher teaches student)
  IF sender_role = 'student' AND recipient_role = 'teacher' THEN
    RETURN EXISTS (
      SELECT 1 FROM get_student_messageable_teachers(can_message.sender_id)
      WHERE teacher_id = can_message.recipient_id
    );
  END IF;
  
  -- Student to student (check if classmates with shared subjects)
  IF sender_role = 'student' AND recipient_role = 'student' THEN
    RETURN EXISTS (
      SELECT 1 FROM get_student_messageable_classmates(can_message.sender_id)
      WHERE classmate_id = can_message.recipient_id
    );
  END IF;
  
  -- Teacher to teacher (optional - allow by default)
  IF sender_role = 'teacher' AND recipient_role = 'teacher' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get or create a direct conversation between two users
-- This ensures no duplicate conversations and provides deterministic behavior
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  can_msg BOOLEAN;
BEGIN
  -- Check if messaging is allowed
  SELECT can_message(user1_id, user2_id) INTO can_msg;
  
  IF NOT can_msg THEN
    RAISE EXCEPTION 'Messaging not allowed between these users';
  END IF;
  
  -- Check if conversation already exists (bidirectional check)
  SELECT c.id INTO conv_id
  FROM conversations c
  WHERE c.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp1 
      WHERE cp1.conversation_id = c.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp2 
      WHERE cp2.conversation_id = c.id AND cp2.user_id = user2_id
    )
  LIMIT 1;
  
  -- If exists, return it
  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;
  
  -- Create new conversation
  INSERT INTO conversations (type, created_by, created_at, updated_at)
  VALUES ('direct', user1_id, NOW(), NOW())
  RETURNING id INTO conv_id;
  
  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
  VALUES 
    (conv_id, user1_id, NOW()),
    (conv_id, user2_id, NOW());
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_teacher_messageable_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_teachers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_messageable_classmates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_message(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_class ON profiles(role, form_class);
CREATE INDEX IF NOT EXISTS idx_profiles_subjects ON profiles USING GIN(subjects);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_subjects ON teacher_classes USING GIN(subjects);
