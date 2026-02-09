-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignments', 'assignments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated uploads to 'assignments'
CREATE POLICY "Authenticated users can upload assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assignments');

-- Policy to allow authenticated reads from 'assignments'
CREATE POLICY "Authenticated users can read assignments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'assignments');

-- Policy to allow authenticated uploads to 'notes'
CREATE POLICY "Authenticated users can upload notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'notes');

-- Policy to allow authenticated reads from 'notes'
CREATE POLICY "Authenticated users can read notes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'notes');

-- Policy to allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (auth.uid() = owner);
