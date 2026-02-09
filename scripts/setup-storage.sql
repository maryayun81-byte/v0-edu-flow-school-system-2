-- Create storage buckets for Assignments and Notes
-- Run this in the Supabase SQL Editor

-- 1. Create 'assignments' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignments', 'assignments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'notes' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Create 'documents' bucket (Fallback)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (Drop existing to avoid conflicts)

-- ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "Authenticated Upload Assignments" ON storage.objects;
CREATE POLICY "Authenticated Upload Assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assignments');

DROP POLICY IF EXISTS "Authenticated Read Assignments" ON storage.objects;
CREATE POLICY "Authenticated Read Assignments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'assignments');

-- NOTES POLICIES
DROP POLICY IF EXISTS "Authenticated Upload Notes" ON storage.objects;
CREATE POLICY "Authenticated Upload Notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes');

DROP POLICY IF EXISTS "Authenticated Read Notes" ON storage.objects;
CREATE POLICY "Authenticated Read Notes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'notes');

-- DOCUMENTS POLICIES (Fallback)
DROP POLICY IF EXISTS "Authenticated Upload Documents" ON storage.objects;
CREATE POLICY "Authenticated Upload Documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated Read Documents" ON storage.objects;
CREATE POLICY "Authenticated Read Documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- GENERAL DELETE POLICY
DROP POLICY IF EXISTS "Users Delete Own Files" ON storage.objects;
CREATE POLICY "Users Delete Own Files"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);
