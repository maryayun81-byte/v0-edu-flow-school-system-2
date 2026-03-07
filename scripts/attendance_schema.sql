-- ============================================================
-- ATTENDANCE & EXAM ELIGIBILITY SYSTEM — SCHEMA MIGRATION
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. KENYAN PUBLIC HOLIDAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kenyan_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE, -- TRUE = applies every year regardless of date
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Kenyan Public Holidays (2025 and 2026)
INSERT INTO public.kenyan_holidays (name, holiday_date, year, is_recurring) VALUES
  ('New Year''s Day', '2025-01-01', 2025, TRUE),
  ('Good Friday', '2025-04-18', 2025, FALSE),
  ('Easter Monday', '2025-04-21', 2025, FALSE),
  ('Labour Day', '2025-05-01', 2025, TRUE),
  ('Madaraka Day', '2025-06-01', 2025, TRUE),
  ('Huduma Day', '2025-10-10', 2025, TRUE),
  ('Mashujaa Day', '2025-10-20', 2025, TRUE),
  ('Jamhuri Day', '2025-12-12', 2025, TRUE),
  ('Christmas Day', '2025-12-25', 2025, TRUE),
  ('Boxing Day', '2025-12-26', 2025, TRUE),
  ('New Year''s Day', '2026-01-01', 2026, TRUE),
  ('Good Friday', '2026-04-03', 2026, FALSE),
  ('Easter Monday', '2026-04-06', 2026, FALSE),
  ('Labour Day', '2026-05-01', 2026, TRUE),
  ('Madaraka Day', '2026-06-01', 2026, TRUE),
  ('Huduma Day', '2026-10-10', 2026, TRUE),
  ('Mashujaa Day', '2026-10-20', 2026, TRUE),
  ('Jamhuri Day', '2026-12-12', 2026, TRUE),
  ('Christmas Day', '2026-12-25', 2026, TRUE),
  ('Boxing Day', '2026-12-26', 2026, TRUE)
ON CONFLICT (holiday_date) DO NOTHING;

-- ============================================================
-- 2. TUITION EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tuition_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- Days that count toward attendance evaluation (e.g. 12 for April/August, 31 for December)
  attendance_eval_days INTEGER NOT NULL DEFAULT 12,
  -- Which day number is the exam (e.g. day 13)
  exam_day_number INTEGER NOT NULL DEFAULT 13,
  -- e.g. ["Monday","Tuesday","Wednesday","Thursday","Friday"]
  days_of_operation TEXT[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  -- Custom dates to exclude (in addition to holidays)
  excluded_dates DATE[] DEFAULT ARRAY[]::DATE[],
  -- Attendance threshold percentage (default 80%)
  attendance_threshold NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. EVENT CALENDAR (Valid Attendance Dates per Event)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.tuition_events(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  day_number INTEGER NOT NULL, -- 1, 2, 3 ... attendance_eval_days
  is_exam_day BOOLEAN DEFAULT FALSE,
  day_of_week TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, calendar_date)
);

CREATE INDEX IF NOT EXISTS idx_event_calendar_event_id ON public.event_calendar(event_id);
CREATE INDEX IF NOT EXISTS idx_event_calendar_date ON public.event_calendar(calendar_date);

-- ============================================================
-- 4. CLASS TEACHERS (One Class Teacher Per Class)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  designated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  designated_at TIMESTAMPTZ DEFAULT NOW(),
  -- A class can only have ONE class teacher
  UNIQUE(class_id),
  -- A teacher can only be class teacher for ONE class
  UNIQUE(teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON public.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_id ON public.class_teachers(teacher_id);

-- ============================================================
-- 5. ATTENDANCE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.tuition_events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  marked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One record per student per event per date
  UNIQUE(event_id, student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON public.attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON public.attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_event_date ON public.attendance(event_id, attendance_date);

-- ============================================================
-- 6. ATTENDANCE SETTINGS (Register Reminder Time)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- e.g. "09:00" means deadline is 9:00 AM
  register_deadline_time TEXT NOT NULL DEFAULT '09:00',
  -- How many minutes before deadline to show reminder (default 60 = 1 hour)
  reminder_minutes_before INTEGER NOT NULL DEFAULT 60,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row
INSERT INTO public.attendance_settings (register_deadline_time, reminder_minutes_before)
VALUES ('09:00', 60)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. EXAM ELIGIBILITY (Computed per Student per Event)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_eligibility (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.tuition_events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  -- Raw counts
  total_eval_days INTEGER NOT NULL DEFAULT 0,
  days_present INTEGER NOT NULL DEFAULT 0,
  days_late INTEGER NOT NULL DEFAULT 0,
  days_absent INTEGER NOT NULL DEFAULT 0,
  days_excused INTEGER NOT NULL DEFAULT 0,
  -- Adjusted evaluation days (total_eval_days - days_excused)
  adjusted_eval_days INTEGER NOT NULL DEFAULT 0,
  -- Attendance percentage: (present + late) / adjusted_eval_days * 100
  attendance_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  -- Whether student qualifies
  is_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  -- Threshold used at time of calculation
  threshold_used NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  -- When the eligibility was last calculated
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Who generated the list
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(event_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_eligibility_event_id ON public.exam_eligibility(event_id);
CREATE INDEX IF NOT EXISTS idx_exam_eligibility_student_id ON public.exam_eligibility(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_eligibility_class_id ON public.exam_eligibility(class_id);

-- ============================================================
-- 8. ATTENDANCE LOGS (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.tuition_events(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'register_submitted', 'record_overridden', 'eligibility_generated', etc.
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  attendance_date DATE,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_event_id ON public.attendance_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_performed_by ON public.attendance_logs(performed_by);

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.kenyan_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Kenyan Holidays: readable by all authenticated users
CREATE POLICY "Authenticated users can read holidays" ON public.kenyan_holidays
  FOR SELECT TO authenticated USING (TRUE);

-- Tuition Events: readable by all, writable by admins
CREATE POLICY "All authenticated can view events" ON public.tuition_events
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage events" ON public.tuition_events
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Event Calendar: readable by all
CREATE POLICY "All can view event calendar" ON public.event_calendar
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage event calendar" ON public.event_calendar
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Class Teachers: readable by all, writable by admins
CREATE POLICY "All can view class teachers" ON public.class_teachers
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage class teachers" ON public.class_teachers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attendance: 
-- Students see their own records
-- Class teachers see records for their class
-- Admins see all
CREATE POLICY "Students see own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );

CREATE POLICY "Class teachers can insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    marked_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.class_teachers ct
      WHERE ct.teacher_id = auth.uid() AND ct.class_id = attendance.class_id
    )
  );

CREATE POLICY "Admins can manage all attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attendance Settings: readable by teachers+admins, writable by admins
CREATE POLICY "Teachers and admins can view settings" ON public.attendance_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );
CREATE POLICY "Admins can manage settings" ON public.attendance_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Exam Eligibility:
-- Students see their own, teachers see their class, admins see all
CREATE POLICY "Students see own eligibility" ON public.exam_eligibility
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );
CREATE POLICY "Admins can manage eligibility" ON public.exam_eligibility
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Attendance Logs: admins only
CREATE POLICY "Admins see all logs" ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Authenticated can insert logs" ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- ============================================================
-- 10. HELPFUL VIEWS
-- ============================================================

-- View: Attendance summary per student per event
CREATE OR REPLACE VIEW public.attendance_summary AS
SELECT
  a.event_id,
  a.student_id,
  a.class_id,
  COUNT(*) FILTER (WHERE a.status = 'present') AS days_present,
  COUNT(*) FILTER (WHERE a.status = 'late') AS days_late,
  COUNT(*) FILTER (WHERE a.status = 'absent') AS days_absent,
  COUNT(*) FILTER (WHERE a.status = 'excused') AS days_excused,
  COUNT(*) AS total_recorded,
  ROUND(
    (COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::NUMERIC /
    NULLIF(COUNT(*) - COUNT(*) FILTER (WHERE a.status = 'excused'), 0)) * 100,
    2
  ) AS attendance_percentage
FROM public.attendance a
GROUP BY a.event_id, a.student_id, a.class_id;

-- View: Today's unsubmitted registers alert
CREATE OR REPLACE VIEW public.missed_attendance_alerts AS
SELECT
  c.id AS class_id,
  c.name AS class_name,
  ct.teacher_id,
  p.full_name AS teacher_name,
  ec.calendar_date AS attendance_date,
  te.id AS event_id,
  te.name AS event_name
FROM public.event_calendar ec
JOIN public.tuition_events te ON te.id = ec.event_id AND te.status = 'active'
JOIN public.class_teachers ct ON TRUE
JOIN public.classes c ON c.id = ct.class_id
JOIN public.profiles p ON p.id = ct.teacher_id
WHERE ec.calendar_date = CURRENT_DATE
  AND ec.is_exam_day = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.event_id = ec.event_id
      AND a.class_id = ct.class_id
      AND a.attendance_date = ec.calendar_date
  );
