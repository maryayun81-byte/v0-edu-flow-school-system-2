-- Safely recreate the view to allow schema changes
DROP VIEW IF EXISTS public.missed_attendance_alerts CASCADE;

-- Create a view to identify missing registers for the current day
CREATE VIEW public.missed_attendance_alerts AS
WITH active_event AS (
    SELECT id, name 
    FROM public.tuition_events 
    WHERE status = 'active' 
    LIMIT 1
)
SELECT 
    c.id as class_id,
    c.name AS class_name,
    p.full_name AS teacher_name,
    CURRENT_DATE AS attendance_date,
    ae.name AS event_name
FROM public.class_teachers ct
JOIN public.classes c ON ct.class_id = c.id
JOIN public.profiles p ON ct.teacher_id = p.id
CROSS JOIN active_event ae
LEFT JOIN public.attendance a ON a.class_id = c.id 
    AND a.attendance_date = CURRENT_DATE
    AND a.event_id = ae.id
WHERE a.id IS NULL;

-- Enable RLS (Optional, usually views inherit permissions but good to be explicit if using Supabase)
-- GRANT SELECT ON public.missed_attendance_alerts TO authenticated;
