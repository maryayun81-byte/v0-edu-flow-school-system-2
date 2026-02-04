-- check count of sessions by status
SELECT status, COUNT(*) 
FROM timetable_sessions 
GROUP BY status;

-- check sessions
SELECT 
  ts.id,
  ts.day_of_week,
  ts.start_time,
  ts.status,
  ts.teacher_id,
  p.full_name as teacher_name,
  p.role as teacher_role,
  c.name as class_name
FROM timetable_sessions ts
LEFT JOIN profiles p ON ts.teacher_id = p.id
LEFT JOIN classes c ON ts.class_id = c.id
LIMIT 20;

-- check all profiles
SELECT id, email, role, full_name, created_at FROM profiles ORDER BY created_at DESC LIMIT 10;
