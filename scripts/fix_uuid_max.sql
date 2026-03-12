-- Fix the MAX(uuid) error by casting to text and back to uuid
CREATE OR REPLACE FUNCTION public.fn_recalculate_student_eligibility(p_event_id UUID, p_student_id UUID)
RETURNS VOID AS $$
DECLARE
    v_eval_days INTEGER;
    v_threshold NUMERIC;
    v_class_id UUID;
    v_days_present INTEGER;
    v_days_late INTEGER;
    v_days_absent INTEGER;
    v_days_excused INTEGER;
    v_total_eval_days INTEGER;
    v_adjusted_eval_days INTEGER;
    v_attendance_pct NUMERIC;
    v_is_eligible BOOLEAN;
BEGIN
    -- 1. Get Event Parameters
    SELECT attendance_eval_days, attendance_threshold 
    INTO v_eval_days, v_threshold
    FROM public.tuition_events
    WHERE id = p_event_id;

    -- 2. Aggregate Attendance Data
    SELECT 
        MAX(class_id::text)::uuid,
        COUNT(*) FILTER (WHERE status = 'present'),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'absent'),
        COUNT(*) FILTER (WHERE status = 'excused')
    INTO v_class_id, v_days_present, v_days_late, v_days_absent, v_days_excused
    FROM public.attendance
    WHERE event_id = p_event_id AND student_id = p_student_id;

    -- 3. Compute Metrics
    v_total_eval_days := v_eval_days;
    v_adjusted_eval_days := GREATEST(0, v_total_eval_days - v_days_excused);
    
    IF v_adjusted_eval_days > 0 THEN
        v_attendance_pct := ROUND(((v_days_present + v_days_late)::NUMERIC / v_adjusted_eval_days) * 100, 2);
    ELSE
        v_attendance_pct := 0;
    END IF;

    -- 4. Determine Eligibility
    v_is_eligible := (v_attendance_pct >= v_threshold) AND ((v_days_present + v_days_late + v_days_absent) >= v_eval_days);

    -- 5. Upsert Result
    INSERT INTO public.exam_eligibility (
        event_id, student_id, class_id,
        days_present, days_late, days_absent, days_excused,
        total_eval_days, adjusted_eval_days, attendance_percentage,
        is_eligible, threshold_used, calculated_at
    ) VALUES (
        p_event_id, p_student_id, v_class_id,
        v_days_present, v_days_late, v_days_absent, v_days_excused,
        v_total_eval_days, v_adjusted_eval_days, LEAST(100, v_attendance_pct),
        v_is_eligible, v_threshold, NOW()
    )
    ON CONFLICT (event_id, student_id) DO UPDATE SET
        class_id = EXCLUDED.class_id,
        days_present = EXCLUDED.days_present,
        days_late = EXCLUDED.days_late,
        days_absent = EXCLUDED.days_absent,
        days_excused = EXCLUDED.days_excused,
        total_eval_days = EXCLUDED.total_eval_days,
        adjusted_eval_days = EXCLUDED.adjusted_eval_days,
        attendance_percentage = EXCLUDED.attendance_percentage,
        is_eligible = EXCLUDED.is_eligible,
        threshold_used = EXCLUDED.threshold_used,
        calculated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.fn_mass_recalculate_eligibility(p_event_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.exam_eligibility (
        event_id, student_id, class_id,
        days_present, days_late, days_absent, days_excused,
        total_eval_days, adjusted_eval_days, attendance_percentage,
        is_eligible, threshold_used, calculated_at
    )
    SELECT 
        a.event_id, a.student_id, MAX(a.class_id::text)::uuid,
        COUNT(*) FILTER (WHERE a.status = 'present'),
        COUNT(*) FILTER (WHERE a.status = 'late'),
        COUNT(*) FILTER (WHERE a.status = 'absent'),
        COUNT(*) FILTER (WHERE a.status = 'excused'),
        te.attendance_eval_days,
        GREATEST(0, te.attendance_eval_days - COUNT(*) FILTER (WHERE a.status = 'excused')),
        ROUND((COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::NUMERIC / 
               NULLIF(GREATEST(0, te.attendance_eval_days - COUNT(*) FILTER (WHERE a.status = 'excused')), 0)) * 100, 2),
        (ROUND((COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::NUMERIC / 
               NULLIF(GREATEST(0, te.attendance_eval_days - COUNT(*) FILTER (WHERE a.status = 'excused')), 0)) * 100, 2) >= te.attendance_threshold)
        AND (COUNT(*) FILTER (WHERE a.status IN ('present', 'late', 'absent')) >= te.attendance_eval_days),
        te.attendance_threshold,
        NOW()
    FROM public.attendance a
    JOIN public.tuition_events te ON te.id = a.event_id
    WHERE a.event_id = p_event_id
    GROUP BY a.event_id, a.student_id, te.attendance_eval_days, te.attendance_threshold
    ON CONFLICT (event_id, student_id) DO UPDATE SET
        days_present = EXCLUDED.days_present,
        days_late = EXCLUDED.days_late,
        days_absent = EXCLUDED.days_absent,
        days_excused = EXCLUDED.days_excused,
        total_eval_days = EXCLUDED.total_eval_days,
        adjusted_eval_days = EXCLUDED.adjusted_eval_days,
        attendance_percentage = EXCLUDED.attendance_percentage,
        is_eligible = EXCLUDED.is_eligible,
        calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
