-- Migration script to fix quiz_questions schema
-- This script ensures the quiz_questions table uses 'marks' instead of 'points'

-- Check if 'points' column exists and rename it to 'marks'
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'points'
  ) THEN
    ALTER TABLE quiz_questions RENAME COLUMN points TO marks;
    RAISE NOTICE 'Renamed points column to marks in quiz_questions table';
  ELSE
    RAISE NOTICE 'Column points does not exist, no action needed';
  END IF;
END $$;

-- Ensure marks column exists with proper defaults
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'marks'
  ) THEN
    ALTER TABLE quiz_questions ADD COLUMN marks INTEGER DEFAULT 10;
    RAISE NOTICE 'Added marks column to quiz_questions table';
  ELSE
    RAISE NOTICE 'Column marks already exists';
  END IF;
END $$;

-- Verify the schema
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quiz_questions' AND column_name = 'marks'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✅ Schema verification passed: marks column exists in quiz_questions table';
  ELSE
    RAISE EXCEPTION '❌ Schema verification failed: marks column does not exist in quiz_questions table';
  END IF;
END $$;
