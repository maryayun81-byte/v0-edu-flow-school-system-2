-- ========================================
-- MIGRATION: ADD TARGET CURRICULUM
-- ========================================

-- Add column if not exists
ALTER TABLE transcript_themes 
ADD COLUMN IF NOT EXISTS target_curriculum TEXT DEFAULT 'ALL';

-- Update existing records to default
UPDATE transcript_themes 
SET target_curriculum = 'ALL' 
WHERE target_curriculum IS NULL;

-- Optional: Add index for performance check
CREATE INDEX IF NOT EXISTS idx_transcript_themes_curriculum 
ON transcript_themes(is_default, target_curriculum);
