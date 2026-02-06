-- Update the school name in settings if it exists
UPDATE school_settings
SET school_name = 'Peak Performance Tutoring'
WHERE id IS NOT NULL;

-- If no settings exist, insert default
INSERT INTO school_settings (school_name, updated_at)
SELECT 'Peak Performance Tutoring', NOW()
WHERE NOT EXISTS (SELECT 1 FROM school_settings);
