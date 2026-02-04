-- =====================================================
-- COMPREHENSIVE FIX FOR ALL ISSUES
-- =====================================================
-- This script fixes:
-- 1. Teacher role assignment (existing teachers with wrong role)
-- 2. Conversations table missing columns (type, name)
-- 3. Conversation participants user_role constraint error
-- =====================================================

-- =====================================================
-- PART 1: FIX CONVERSATIONS TABLE
-- =====================================================

-- Add the type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN type TEXT NOT NULL DEFAULT 'direct';
    
    RAISE NOTICE 'Added type column to conversations table';
  ELSE
    RAISE NOTICE 'Type column already exists in conversations table';
  END IF;
END $$;

-- Add the name column if it doesn't exist (for group conversations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' 
    AND column_name = 'name'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN name TEXT;
    
    RAISE NOTICE 'Added name column to conversations table';
  ELSE
    RAISE NOTICE 'Name column already exists in conversations table';
  END IF;
END $$;

-- =====================================================
-- PART 2: FIX CONVERSATION PARTICIPANTS USER_ROLE
-- =====================================================

-- Make user_role nullable to prevent constraint errors
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_participants' 
    AND column_name = 'user_role'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE conversation_participants 
    ALTER COLUMN user_role DROP NOT NULL;
    
    RAISE NOTICE 'Made user_role column nullable';
  ELSE
    RAISE NOTICE 'user_role column is already nullable or does not exist';
  END IF;
END $$;

-- Set default value for user_role
ALTER TABLE conversation_participants 
ALTER COLUMN user_role SET DEFAULT 'member';

-- Update existing NULL values
UPDATE conversation_participants 
SET user_role = 'member' 
WHERE user_role IS NULL;

-- Update get_or_create_conversation function to provide user_role
CREATE OR REPLACE FUNCTION get_or_create_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  can_msg BOOLEAN;
  user1_role TEXT;
  user2_role TEXT;
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
  
  -- Get user roles from profiles
  SELECT role INTO user1_role FROM profiles WHERE id = user1_id;
  SELECT role INTO user2_role FROM profiles WHERE id = user2_id;
  
  -- Default to 'member' if role not found
  user1_role := COALESCE(user1_role, 'member');
  user2_role := COALESCE(user2_role, 'member');
  
  -- Create new conversation
  INSERT INTO conversations (type, created_by, created_at, updated_at)
  VALUES ('direct', user1_id, NOW(), NOW())
  RETURNING id INTO conv_id;
  
  -- Add both participants with their roles
  INSERT INTO conversation_participants (conversation_id, user_id, user_role, joined_at)
  VALUES 
    (conv_id, user1_id, user1_role, NOW()),
    (conv_id, user2_id, user2_role, NOW());
  
  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID) TO authenticated;

-- =====================================================
-- PART 3: FIX TEACHER ROLE ASSIGNMENTS
-- =====================================================

-- Show current state
SELECT 
  'BEFORE FIX' as status,
  COUNT(*) FILTER (WHERE p.role = 'student' AND u.raw_user_meta_data->>'role' = 'teacher') as teachers_with_wrong_role,
  COUNT(*) FILTER (WHERE p.role = 'teacher') as correct_teachers,
  COUNT(*) FILTER (WHERE p.role = 'student') as total_students,
  COUNT(*) FILTER (WHERE p.role = 'admin') as total_admins
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id;

-- Fix existing teacher accounts
-- Update profiles where auth metadata says 'teacher' but profile says 'student'
UPDATE profiles p
SET 
  role = 'teacher',
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND p.role = 'student'
  AND u.raw_user_meta_data->>'role' = 'teacher';

-- Show results after fix
SELECT 
  'AFTER FIX' as status,
  COUNT(*) FILTER (WHERE p.role = 'student' AND u.raw_user_meta_data->>'role' = 'teacher') as teachers_with_wrong_role,
  COUNT(*) FILTER (WHERE p.role = 'teacher') as correct_teachers,
  COUNT(*) FILTER (WHERE p.role = 'student') as total_students,
  COUNT(*) FILTER (WHERE p.role = 'admin') as total_admins
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify conversations table structure
SELECT 
  'conversations' as table_name,
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name IN ('type', 'name', 'created_by', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- Verify conversation_participants structure
SELECT 
  'conversation_participants' as table_name,
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversation_participants' 
AND column_name IN ('user_role', 'role', 'user_id', 'conversation_id')
ORDER BY ordinal_position;

-- Show all teachers
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.role as profile_role,
  u.raw_user_meta_data->>'role' as auth_role,
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'teacher'
ORDER BY p.created_at DESC;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 
  '✅ All fixes applied successfully!' as message,
  'Teachers should now appear in admin dashboard' as note1,
  'Messaging system should work without errors' as note2,
  'Teacher dashboard should load properly' as note3,
  'Conversations can now be created' as note4;
