-- Notifications for Assignments System

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
        user_id,
        title,
        message,
        type,
        link,
        created_at
    ) VALUES (
        teacher_id,
        'New Submission Received',
        student_name || ' submitted: ' || assignment_title,
        'info',
        '/teacher/dashboard', -- Ideally link to specific assignment
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_assignment_submission ON student_submissions;
CREATE TRIGGER on_assignment_submission
AFTER INSERT ON student_submissions
FOR EACH ROW
EXECUTE FUNCTION notify_assignment_submission();


-- 2. Notify Student when Teacher Grades
CREATE OR REPLACE FUNCTION notify_assignment_graded()
RETURNS TRIGGER AS $$
DECLARE
    assignment_title TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM 'GRADED' AND NEW.status = 'GRADED' THEN
        SELECT title INTO assignment_title FROM assignments WHERE id = NEW.assignment_id;

        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            link,
            created_at
        ) VALUES (
            NEW.student_id,
            'Assignment Graded',
            'Your submission for ' || assignment_title || ' has been graded.',
            'success',
            '/student/dashboard',
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_assignment_graded ON student_submissions;
CREATE TRIGGER on_assignment_graded
AFTER UPDATE ON student_submissions
FOR EACH ROW
EXECUTE FUNCTION notify_assignment_graded();
