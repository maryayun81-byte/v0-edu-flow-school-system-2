-- Create missing classes based on teacher requests
-- Teachers requested: Form 1, Form 2, Grade 7, Grade 8, Grade 9
-- But only Form 3, Form 4, Grade 6 exist.
-- This script adds the missing ones.

INSERT INTO classes (name, form_level)
VALUES 
    ('Form 1', 'Form 1'),
    ('Form 2', 'Form 2'),
    ('Grade 7', 'Grade 7 (CBC)'),
    ('Grade 8', 'Grade 8 (CBC)'),
    ('Grade 9', 'Grade 9 (CBC)')
ON CONFLICT (name) DO NOTHING; -- Avoid duplicates if runs multiple times

-- Let's also add lowercase variants just in case, or ensure our names are standard.
-- The existing ones are lowercase "form 3", "grade 6".
-- To match style, maybe we should insert lowercase? 
-- But "Form 1" looks better. The migration script uses ILIKE so case doesn't matter for matching.
-- Let's insert Title Case as it looks better in UI.

-- Verify what we have after insertion
SELECT * FROM classes ORDER BY name;
