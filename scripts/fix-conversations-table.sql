-- =====================================================
-- FIX CONVERSATIONS TABLE - ADD MISSING TYPE COLUMN
-- =====================================================
-- This fixes the error: "column c.type does not exist"
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

-- Verify the columns exist
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name IN ('type', 'name', 'created_by', 'created_at', 'updated_at')
ORDER BY ordinal_position;
