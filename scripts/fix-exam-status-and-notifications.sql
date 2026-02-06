-- =============================================
-- FIX: Exam Status Updates and Notifications
-- =============================================

-- PART 1: Create or replace log_exam_audit function
-- This function is called when exam status changes

-- Drop existing function first (in case return type changed)
DROP FUNCTION IF EXISTS log_exam_audit(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION log_exam_audit(
    p_exam_id UUID,
    p_action_type TEXT,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if audit_logs table exists, if not, just return
    -- This prevents errors if the table hasn't been created yet
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
    ) THEN
        RETURN;
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        exam_id,
        action_type,
        details,
        created_at,
        created_by
    ) VALUES (
        p_exam_id,
        p_action_type,
        p_details,
        NOW(),
        auth.uid()
    );
END;
$$;

-- PART 2: Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_exam_id ON audit_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- PART 3: Fix notification trigger to match table structure
-- The notifications table has both 'audience' and 'target_audience' columns
-- We need to update the trigger to use the correct columns

CREATE OR REPLACE FUNCTION notify_exam_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_target_roles TEXT[];
BEGIN
  -- Determine notification based on new status
  CASE NEW.status
    WHEN 'Active' THEN
      v_notification_title := 'Exam Activated: ' || NEW.exam_name;
      v_notification_message := 'The exam "' || NEW.exam_name || '" is now active. Students can view the schedule.';
      v_target_roles := ARRAY['teacher', 'student'];
    
    WHEN 'Closed' THEN
      v_notification_title := 'Exam Closed: ' || NEW.exam_name;
      v_notification_message := 'The exam "' || NEW.exam_name || '" is now closed. Teachers can begin entering marks.';
      v_target_roles := ARRAY['teacher'];
    
    WHEN 'Finalized' THEN
      v_notification_title := 'Exam Finalized: ' || NEW.exam_name;
      v_notification_message := 'The exam "' || NEW.exam_name || '" has been finalized. All marks are now locked.';
      v_target_roles := ARRAY['teacher', 'admin'];
    
    ELSE
      RETURN NEW;
  END CASE;

  -- Insert notification using target_audience array
  INSERT INTO notifications (
    title,
    message,
    type,
    target_audience,
    broadcast,
    created_at
  ) VALUES (
    v_notification_title,
    v_notification_message,
    'info',
    v_target_roles,
    true,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_notify_exam_status ON exams;
CREATE TRIGGER trigger_notify_exam_status
  AFTER UPDATE OF status ON exams
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_exam_status_change();

-- PART 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_exam_audit(UUID, TEXT, JSONB) TO authenticated;
GRANT ALL ON audit_logs TO authenticated;

-- PART 5: Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all audit logs
CREATE POLICY "Admins can view all audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Policy: Authenticated users can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- VERIFICATION: Test the functions
DO $$
BEGIN
    RAISE NOTICE 'Setup complete! Functions and triggers are ready.';
    RAISE NOTICE 'log_exam_audit function: %', 
        (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'log_exam_audit');
    RAISE NOTICE 'audit_logs table: %',
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'audit_logs');
    RAISE NOTICE 'notify_exam_status_change function: %',
        (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'notify_exam_status_change');
END $$;
