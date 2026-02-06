-- Add Assignment Icons/Entry to Navigation (Example data if needed)
-- This script just verifies the schema is applied correctly
SELECT table_name FROM information_schema.tables WHERE table_name IN ('assignments', 'assignment_questions', 'student_submissions');
