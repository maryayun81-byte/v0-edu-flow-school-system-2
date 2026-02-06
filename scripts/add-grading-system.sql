-- =============================================
-- Add Grading System & Fix School Name
-- =============================================

-- 1. Add grading_system column to school_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_settings' AND column_name = 'grading_system') THEN
        ALTER TABLE school_settings ADD COLUMN grading_system JSONB DEFAULT '[
            {"min": 80, "max": 100, "grade": "A", "points": 12, "remarks": "Excellent"},
            {"min": 75, "max": 79, "grade": "A-", "points": 11, "remarks": "Very Good"},
            {"min": 70, "max": 74, "grade": "B+", "points": 10, "remarks": "Good"},
            {"min": 65, "max": 69, "grade": "B", "points": 9, "remarks": "Good"},
            {"min": 60, "max": 64, "grade": "B-", "points": 8, "remarks": "Fair"},
            {"min": 55, "max": 59, "grade": "C+", "points": 7, "remarks": "Fair"},
            {"min": 50, "max": 54, "grade": "C", "points": 6, "remarks": "Average"},
            {"min": 45, "max": 49, "grade": "C-", "points": 5, "remarks": "Average"},
            {"min": 40, "max": 44, "grade": "D+", "points": 4, "remarks": "Weak"},
            {"min": 35, "max": 39, "grade": "D", "points": 3, "remarks": "Weak"},
            {"min": 30, "max": 34, "grade": "D-", "points": 2, "remarks": "Very Weak"},
            {"min": 0, "max": 29, "grade": "E", "points": 1, "remarks": "Poor"}
        ]'::jsonb;
    END IF;
END $$;

-- 2. Ensure admin policy allows UPDATE (re-apply to be safe)
DROP POLICY IF EXISTS "Admins can update settings" ON school_settings;
CREATE POLICY "Admins can update settings"
  ON school_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
