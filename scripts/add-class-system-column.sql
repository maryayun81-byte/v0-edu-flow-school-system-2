-- Add education_system column to classes table if it doesn't exist
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS education_system TEXT DEFAULT '8-4-4';

-- Ensure form_level accepts flexible text (it likely already does)
ALTER TABLE classes ALTER COLUMN form_level TYPE TEXT;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'classes';
