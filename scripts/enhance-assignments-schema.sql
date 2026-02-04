-- Enhance assignments table to support detailed creation flow
-- Columns to add: attachment_urls, submission_type, allow_late_submissions, is_published, max_marks, subject, class_name

DO $$ 
BEGIN 
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'attachment_urls') THEN
        ALTER TABLE assignments ADD COLUMN attachment_urls TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'submission_type') THEN
        ALTER TABLE assignments ADD COLUMN submission_type TEXT DEFAULT 'both'; -- 'file', 'text', 'both'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'allow_late_submissions') THEN
        ALTER TABLE assignments ADD COLUMN allow_late_submissions BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'is_published') THEN
        ALTER TABLE assignments ADD COLUMN is_published BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'max_marks') THEN
        ALTER TABLE assignments ADD COLUMN max_marks INTEGER DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'subject') THEN
        ALTER TABLE assignments ADD COLUMN subject TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'class_name') THEN
        ALTER TABLE assignments ADD COLUMN class_name TEXT;
    END IF;

    -- Create storage bucket if it doesn't exist (handled via insert into storage.buckets)
    -- This is often tricky in SQL scripts as it touches a different schema, 
    -- but usually standard Supabase setup allows insert to storage.buckets
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('assignment-attachments', 'assignment-attachments', true)
    ON CONFLICT (id) DO NOTHING;

    -- Storage Policies
    -- 1. Give public read access? Or authenticated? 
    -- Assignments should be readable by students and teachers.
    
    -- Drop existing policies to avoid conflict
    DROP POLICY IF EXISTS "Authenticated users can upload assignments" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can view assignments" ON storage.objects;

    -- Create policies (using raw SQL for storage policies usually works in Supabase dashboard, 
    -- but from client SQL it might require admin rights. Assuming this script runs as admin/service_role or similar)
    -- Note: We often can't run this easily from client. 
    -- But I'll include it for the user to run.
END $$;

-- Policies need to be outside the DO block often
CREATE POLICY "Authenticated users can upload assignments" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignment-attachments');

CREATE POLICY "Anyone can view assignments" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'assignment-attachments');

-- RLS Update for assignments table
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage their assignments" ON assignments;
CREATE POLICY "Teachers can manage their assignments" ON assignments
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students can view published assignments" ON assignments;
CREATE POLICY "Students can view published assignments" ON assignments
FOR SELECT TO authenticated
USING (is_published = true); 
