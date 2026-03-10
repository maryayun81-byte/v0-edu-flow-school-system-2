-- 1. Create Activities Table for Personal Dashboard Feeds
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g. 'quiz_completion', 'assignment_submission', 'attendance_mark'
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for Activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- 2. Activities Policies
CREATE POLICY "Users can view their own activities"
    ON activities FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own activities"
    ON activities FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 3. Refine Notifications audience filtering (Robust approach)
-- First, drop the old policy
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;

-- Create a more precise policy that includes target_class_id
CREATE POLICY "Users can view their notifications v2"
    ON notifications
    FOR SELECT
    USING (
        audience = 'all'
        OR (audience = 'individual' AND target_user_id = auth.uid())
        OR (
            audience = 'student' 
            AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'student')
        )
        OR (
            audience = 'teacher' 
            AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'teacher')
        )
        OR (
            target_class_id IS NOT NULL 
            AND EXISTS (
                SELECT 1 FROM student_classes 
                WHERE student_id = auth.uid() AND class_id = notifications.target_class_id
            )
        )
    );

-- 4. Ensure teacher notifications can be sent to specific classes if needed
-- (The target_class_id column already exists from previous script)
