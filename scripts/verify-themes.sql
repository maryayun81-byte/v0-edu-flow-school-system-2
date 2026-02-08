-- ========================================
-- VERIFY THEMES
-- Run this to confirm themes exist
-- ========================================

SELECT 
    name, 
    is_default, 
    target_curriculum, 
    (colors->>'primary') as primary_color 
FROM transcript_themes
ORDER BY target_curriculum, name;
