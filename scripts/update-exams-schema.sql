-- Drop existing constraint if named
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_system_type_check') THEN 
        ALTER TABLE exams DROP CONSTRAINT exams_system_type_check; 
    END IF; 
END $$;

-- Add new constraint
ALTER TABLE exams 
ADD CONSTRAINT exams_system_type_check CHECK (system_type IN ('CBC', '8-4-4', 'Combined'));

