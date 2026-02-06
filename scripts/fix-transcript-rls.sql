-- Allow Admins to manage transcript items (Insert/Update/Delete)
DROP POLICY IF EXISTS "Admins can manage transcript items" ON transcript_items;

CREATE POLICY "Admins can manage transcript items"
  ON transcript_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Ensure users can view their own transcript items (if not already working)
-- Drop duplicate if exists
DROP POLICY IF EXISTS "Users can view transcript items for their transcripts" ON transcript_items;

CREATE POLICY "Users can view transcript items for their transcripts"
  ON transcript_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transcripts 
      WHERE transcripts.id = transcript_items.transcript_id
      AND (
        -- Student viewing their own published transcript
        (transcripts.student_id = auth.uid() AND transcripts.status = 'Published')
        OR
        -- Admin viewing any
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- Force reload schema cache
NOTIFY pgrst, 'reload config';
