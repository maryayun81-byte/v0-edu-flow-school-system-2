-- Add signature_url to school_settings
ALTER TABLE school_settings 
ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Verify column addition
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'school_settings' 
        AND column_name = 'signature_url'
    ) THEN
        RAISE EXCEPTION 'Column signature_url was not added successfully';
    END IF;
END $$;
