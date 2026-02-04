-- =====================================================
-- FIX CONVERSATION PARTICIPANTS USER_ROLE ERROR
-- =====================================================
-- Error: null value in column "user_role" violates not-null constraint
-- Solution: Make user_role nullable OR provide default value
-- =====================================================

-- Option 1: Make user_role nullable (RECOMMENDED)
-- This allows the function to work without needing to fetch roles
ALTER TABLE conversation_participants 
ALTER COLUMN user_role DROP NOT NULL;

-- Set a default value for existing NULL rows
UPDATE conversation_participants 
SET user_role = 'member' 
WHERE user_role IS NULL;

-- Option 2: Add default value
ALTER TABLE conversation_participants 
ALTER COLUMN user_role SET DEFAULT 'member';

-- =====================================================
-- UPDATE get_or_create_conversation FUNCTION
-- =====================================================
-- Update the function to fetch and provide user roles

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check conversation_participants table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'conversation_participants'
ORDER BY ordinal_position;

-- Test query to see if there are any NULL user_role values
SELECT COUNT(*) as null_user_roles
FROM conversation_participants
WHERE user_role IS NULL;
