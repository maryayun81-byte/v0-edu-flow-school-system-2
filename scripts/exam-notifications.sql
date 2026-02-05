-- ========================================
-- EXAM SYSTEM NOTIFICATIONS & REAL-TIME
-- Notification Triggers and Functions
-- ========================================
-- This script adds notification triggers for exam events
-- Run this AFTER the main exam-system-schema.sql
-- ========================================

-- ========================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- ========================================

-- Function to notify on exam status change
CREATE OR REPLACE FUNCTION notify_exam_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_target_audience TEXT[];
BEGIN
  -- Determine notification content based on new status
  CASE NEW.status
    WHEN 'Active' THEN
      v_notification_title := 'Exam Activated: ' || NEW.exam_name;
      v_notification_message := 'The exam "' || NEW.exam_name || '" for ' || NEW.term || ' ' || NEW.academic_year || ' is now active.';
      v_target_audience := ARRAY['teacher', 'student'];
    
    WHEN 'Closed' THEN
      v_notification_title := 'Exam Closed: ' || NEW.exam_name;
      v_notification_message := 'The exam "' || NEW.exam_name || '" is now closed. Teachers can begin entering marks.';
      v_target_audience := ARRAY['teacher'];
    
    WHEN 'Finalized' THEN
      v_notification_title := 'Exam Finalized: ' || NEW.exam_name;
      v_notification_message := 'The exam "' || NEW.exam_name || '" has been finalized. All marks are now locked.';
      v_target_audience := ARRAY['teacher', 'admin'];
    
    ELSE
      RETURN NEW;
  END CASE;

  -- Insert notification for each target audience
  INSERT INTO notifications (
    title,
    message,
    type,
    target_audience,
    created_at
  ) VALUES (
    v_notification_title,
    v_notification_message,
    'exam_status',
    v_target_audience,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Trigger for exam status changes
DROP TRIGGER IF EXISTS trigger_notify_exam_status ON exams;
CREATE TRIGGER trigger_notify_exam_status
  AFTER UPDATE OF status ON exams
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_exam_status_change();

-- ========================================
-- Function to notify on marks submission
CREATE OR REPLACE FUNCTION notify_marks_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam_name TEXT;
  v_class_name TEXT;
  v_subject_name TEXT;
  v_teacher_name TEXT;
BEGIN
  -- Get exam, class, and subject details
  SELECT e.exam_name INTO v_exam_name
  FROM exams e
  WHERE e.id = NEW.exam_id;

  SELECT c.name INTO v_class_name
  FROM classes c
  WHERE c.id = NEW.class_id;

  SELECT s.name INTO v_subject_name
  FROM subjects s
  WHERE s.id = NEW.subject_id;

  SELECT p.full_name INTO v_teacher_name
  FROM profiles p
  WHERE p.id = NEW.teacher_id;

  -- Notify admins about marks submission
  INSERT INTO notifications (
    title,
    message,
    type,
    target_audience,
    created_at
  ) VALUES (
    'Marks Submitted: ' || v_subject_name,
    v_teacher_name || ' has submitted marks for ' || v_subject_name || ' in ' || v_class_name || ' (' || v_exam_name || ').',
    'marks_submitted',
    ARRAY['admin'],
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Trigger for marks submission (only on INSERT, not UPDATE)
DROP TRIGGER IF EXISTS trigger_notify_marks_submitted ON marks;
CREATE TRIGGER trigger_notify_marks_submitted
  AFTER INSERT ON marks
  FOR EACH ROW
  EXECUTE FUNCTION notify_marks_submitted();

-- ========================================
-- Function to notify on transcript publication
CREATE OR REPLACE FUNCTION notify_transcript_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam_name TEXT;
  v_student_id UUID;
BEGIN
  -- Only notify when status changes to Published
  IF NEW.status = 'Published' AND (OLD.status IS NULL OR OLD.status != 'Published') THEN
    -- Get exam details
    SELECT e.exam_name INTO v_exam_name
    FROM exams e
    WHERE e.id = NEW.exam_id;

    v_student_id := NEW.student_id;

    -- Create notification for the specific student
    INSERT INTO notifications (
      title,
      message,
      type,
      target_audience,
      target_user_id,
      created_at
    ) VALUES (
      'Transcript Published: ' || v_exam_name,
      'Your academic transcript for ' || v_exam_name || ' is now available. View your results in the Results tab.',
      'transcript_published',
      ARRAY['student'],
      v_student_id,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for transcript publication
DROP TRIGGER IF EXISTS trigger_notify_transcript_published ON transcripts;
CREATE TRIGGER trigger_notify_transcript_published
  AFTER INSERT OR UPDATE OF status ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION notify_transcript_published();

-- ========================================
-- MISSING MARKS REMINDER FUNCTION
-- ========================================

-- Function to send reminders for missing marks
CREATE OR REPLACE FUNCTION send_missing_marks_reminders(p_exam_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_missing_record RECORD;
  v_exam_name TEXT;
BEGIN
  -- Get exam name
  SELECT exam_name INTO v_exam_name
  FROM exams
  WHERE id = p_exam_id;

  -- Loop through all missing marks
  FOR v_missing_record IN 
    SELECT * FROM get_missing_marks(p_exam_id)
    WHERE missing_count > 0
  LOOP
    -- Send notification to responsible teacher
    IF v_missing_record.responsible_teacher_id IS NOT NULL THEN
      INSERT INTO notifications (
        title,
        message,
        type,
        target_audience,
        target_user_id,
        created_at
      ) VALUES (
        'Missing Marks: ' || v_missing_record.subject_name,
        'You have ' || v_missing_record.missing_count || ' missing marks for ' || 
        v_missing_record.subject_name || ' in ' || v_missing_record.class_name || 
        ' (' || v_exam_name || '). Please complete mark entry.',
        'missing_marks_reminder',
        ARRAY['teacher'],
        v_missing_record.responsible_teacher_id,
        NOW()
      );
    END IF;
  END LOOP;
END;
$$;

-- ========================================
-- TRANSCRIPT READINESS NOTIFICATION
-- ========================================

-- Function to check and notify transcript readiness
CREATE OR REPLACE FUNCTION check_transcript_readiness(p_exam_id UUID, p_class_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_complete BOOLEAN;
  v_exam_name TEXT;
  v_class_name TEXT;
BEGIN
  -- Check if marks are complete
  v_is_complete := are_marks_complete(p_exam_id, p_class_id);

  IF v_is_complete THEN
    -- Get exam and class names
    SELECT exam_name INTO v_exam_name
    FROM exams
    WHERE id = p_exam_id;

    SELECT name INTO v_class_name
    FROM classes
    WHERE id = p_class_id;

    -- Notify admins that transcripts are ready
    INSERT INTO notifications (
      title,
      message,
      type,
      target_audience,
      created_at
    ) VALUES (
      'Transcripts Ready: ' || v_class_name,
      'All marks for ' || v_class_name || ' in ' || v_exam_name || ' are complete. Transcripts are ready to be generated.',
      'transcript_ready',
      ARRAY['admin'],
      NOW()
    );
  END IF;
END;
$$;

-- ========================================
-- REAL-TIME SUBSCRIPTION HELPERS
-- ========================================

-- Function to get real-time exam updates for a user
CREATE OR REPLACE FUNCTION get_user_exam_updates(p_user_id UUID)
RETURNS TABLE (
  exam_id UUID,
  exam_name TEXT,
  status TEXT,
  academic_year INTEGER,
  term TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;

  -- Return exams based on role
  IF v_user_role = 'admin' THEN
    RETURN QUERY
    SELECT e.id, e.exam_name, e.status, e.academic_year, e.term, e.updated_at
    FROM exams e
    ORDER BY e.updated_at DESC
    LIMIT 50;
  
  ELSIF v_user_role = 'teacher' THEN
    RETURN QUERY
    SELECT e.id, e.exam_name, e.status, e.academic_year, e.term, e.updated_at
    FROM exams e
    WHERE e.status IN ('Active', 'Closed', 'Finalized')
    ORDER BY e.updated_at DESC
    LIMIT 50;
  
  ELSIF v_user_role = 'student' THEN
    RETURN QUERY
    SELECT e.id, e.exam_name, e.status, e.academic_year, e.term, e.updated_at
    FROM exams e
    WHERE e.status IN ('Active', 'Finalized')
    ORDER BY e.updated_at DESC
    LIMIT 50;
  END IF;
END;
$$;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify triggers are created
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_schema = 'public' 
-- AND event_object_table IN ('exams', 'marks', 'transcripts');
