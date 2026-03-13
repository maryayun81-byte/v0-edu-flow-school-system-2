-- ============================================================
-- FIX ASSIGNMENT PUBLISHING ISSUES (Safe Version)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. FIRST: Drop the existing broken constraint
ALTER TABLE assignments 
  DROP CONSTRAINT IF EXISTS assignments_submission_type_check;

-- 2. SECOND: Fix all bad/legacy submission_type values BEFORE re-adding constraint
UPDATE assignments SET submission_type = 'MIXED'     WHERE submission_type = 'both';
UPDATE assignments SET submission_type = 'MIXED'     WHERE submission_type = 'file';
UPDATE assignments SET submission_type = 'WORKSHEET' WHERE submission_type IS NULL;
-- Catch-all: anything else not in the valid set (except INTERACTIVE which is valid)
UPDATE assignments 
SET submission_type = 'MIXED'
WHERE submission_type NOT IN ('WORKSHEET', 'PHOTO', 'MIXED', 'INTERACTIVE');

-- 3. THIRD: Now safely add the corrected constraint (includes INTERACTIVE for Online Worksheet)
ALTER TABLE assignments 
  ADD CONSTRAINT assignments_submission_type_check 
  CHECK (submission_type IN ('WORKSHEET','PHOTO','MIXED','INTERACTIVE'));

-- 4. Fix assignments that should be PUBLISHED but are stuck as DRAFT
-- (Has recipients = teacher intended to publish it)
UPDATE assignments a
SET 
  status = 'PUBLISHED',
  published_at = COALESCE(a.published_at, NOW())
WHERE 
  a.status = 'DRAFT'
  AND EXISTS (
    SELECT 1 FROM assignment_recipients ar WHERE ar.assignment_id = a.id
  );

-- 5. Verify results
SELECT id, title, status, submission_type, created_at
FROM assignments
ORDER BY created_at DESC
LIMIT 20;
