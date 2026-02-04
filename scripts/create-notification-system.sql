-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'success', 'urgent')),
    audience TEXT NOT NULL CHECK (audience IN ('student', 'teacher', 'individual', 'all')),
    target_user_id UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Notification Reads Table (Tracks who read what)
CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Notifications
-- Admins can do everything
CREATE POLICY "Admins can do everything on notifications"
    ON notifications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view notifications meant for them
CREATE POLICY "Users can view their notifications"
    ON notifications
    FOR SELECT
    USING (
        audience = 'all'
        OR (audience = 'student' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'student'))
        OR (audience = 'teacher' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'teacher'))
        OR (audience = 'individual' AND target_user_id = auth.uid())
    );

-- 5. RLS Policies for Notification Reads
-- Users can insert their own reads
CREATE POLICY "Users can mark notifications as read"
    ON notification_reads
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can view their own reads
CREATE POLICY "Users can view their own reads"
    ON notification_reads
    FOR SELECT
    USING (user_id = auth.uid());

-- 6. Helper Function to Get Unread Count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_user_role TEXT;
    v_count INTEGER;
BEGIN
    -- Get user role
    SELECT role INTO v_user_role FROM user_roles WHERE user_id = p_user_id;

    SELECT COUNT(*)
    INTO v_count
    FROM notifications n
    WHERE 
        -- Filter by audience
        (
            n.audience = 'all'
            OR (n.audience = 'student' AND v_user_role = 'student')
            OR (n.audience = 'teacher' AND v_user_role = 'teacher')
            OR (n.audience = 'individual' AND n.target_user_id = p_user_id)
        )
        -- Exclude read notifications
        AND NOT EXISTS (
            SELECT 1 FROM notification_reads nr
            WHERE nr.notification_id = n.id AND nr.user_id = p_user_id
        );

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notification_reads TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
