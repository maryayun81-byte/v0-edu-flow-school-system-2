-- Fix Assignment Notification Triggers
-- 1. Fixes "column user_id does not exist" error by changing to recipient_id
-- 2. Updates status check from 'GRADED' to 'MARKED' to match application code

-- 1. Notify Teacher when Student Submits
CREATE OR REPLACE FUNCTION notify_assignment_submission()
RETURNS TRIGGER AS $$
DECLARE
    teacher_id UUID;
    student_name TEXT;
    assignment_title TEXT;
BEGIN
    -- Get assignment details
    SELECT a.teacher_id, a.title, p.full_name
    INTO teacher_id, assignment_title, student_name
    FROM assignments a
    JOIN profiles p ON p.id = NEW.student_id
    WHERE a.id = NEW.assignment_id;

    -- Create Notification
    INSERT INTO notifications (
        recipient_id, -- FIXED: Was user_id
        title,
        message,
        type,
        action_url, -- FIXED: Was link
        created_at,
        read
    ) VALUES (
        teacher_id,
        'New Submission Received',
        student_name || ' submitted: ' || assignment_title,
        'info',
        '/teacher/dashboard',
        NOW(),
        FALSE
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Notify Student when Teacher Grades
CREATE OR REPLACE FUNCTION notify_assignment_graded()
RETURNS TRIGGER AS $$
DECLARE
    assignment_title TEXT;
BEGIN
    -- FIXED: Updated status check to 'MARKED' to match application code
    IF OLD.status IS DISTINCT FROM 'MARKED' AND NEW.status = 'MARKED' THEN
        SELECT title INTO assignment_title FROM assignments WHERE id = NEW.assignment_id;

        INSERT INTO notifications (
            recipient_id, -- FIXED: Was user_id
            title,
            message,
            type,
            action_url, -- FIXED: Was link
            created_at,
            read
        ) VALUES (
            NEW.student_id,
            'Assignment Graded',
            'Your submission for ' || assignment_title || ' has been graded.',
            'success',
            '/student/dashboard',
            NOW(),
            FALSE
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach triggers (just in case)
DROP TRIGGER IF EXISTS on_assignment_submission ON student_submissions;
CREATE TRIGGER on_assignment_submission
AFTER INSERT ON student_submissions
FOR EACH ROW
EXECUTE FUNCTION notify_assignment_submission();

DROP TRIGGER IF EXISTS on_assignment_graded ON student_submissions;
CREATE TRIGGER on_assignment_graded
AFTER UPDATE ON student_submissions
FOR EACH ROW
EXECUTE FUNCTION notify_assignment_graded();
