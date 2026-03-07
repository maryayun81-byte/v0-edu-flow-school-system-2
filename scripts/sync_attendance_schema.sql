-- ============================================================
-- TUITION EVENTS SCHEMA SYNC
-- Run this in your Supabase SQL Editor to ensure all columns exist
-- ============================================================

-- Add attendance_eval_days if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='attendance_eval_days') THEN
        ALTER TABLE public.tuition_events ADD COLUMN attendance_eval_days INTEGER NOT NULL DEFAULT 12;
    END IF;
END $$;

-- Add exam_day_number if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='exam_day_number') THEN
        ALTER TABLE public.tuition_events ADD COLUMN exam_day_number INTEGER NOT NULL DEFAULT 13;
    END IF;
END $$;

-- Add days_of_operation if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='days_of_operation') THEN
        ALTER TABLE public.tuition_events ADD COLUMN days_of_operation TEXT[] NOT NULL DEFAULT ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'];
    END IF;
END $$;

-- Add excluded_dates if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='excluded_dates') THEN
        ALTER TABLE public.tuition_events ADD COLUMN excluded_dates DATE[] DEFAULT ARRAY[]::DATE[];
    END IF;
END $$;

-- Add attendance_threshold if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='attendance_threshold') THEN
        ALTER TABLE public.tuition_events ADD COLUMN attendance_threshold NUMERIC(5,2) NOT NULL DEFAULT 80.00;
    END IF;
END $$;

-- Add location if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='location') THEN
        ALTER TABLE public.tuition_events ADD COLUMN location TEXT;
    END IF;
END $$;

-- Handle phantom holiday_type column (if exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='holiday_type') THEN
        -- Make it nullable if it exists to stop constraint violations
        ALTER TABLE public.tuition_events ALTER COLUMN holiday_type DROP NOT NULL;
    END IF;
END $$;

-- Handle phantom academic_year column (if exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='academic_year') THEN
        -- Make it nullable or provide a default
        ALTER TABLE public.tuition_events ALTER COLUMN academic_year DROP NOT NULL;
    END IF;
END $$;

-- Handle phantom term column (if exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tuition_events' AND column_name='term') THEN
        -- Make it nullable
        ALTER TABLE public.tuition_events ALTER COLUMN term DROP NOT NULL;
    END IF;
END $$;

-- Refresh PostgREST cache (Supabase Dashboard > Settings > API > Refresh Schema Cache)
-- OR just run this to nudge it:
NOTIFY pgrst, 'reload schema';
