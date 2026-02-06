-- =============================================
-- School Settings & Branding Schema
-- =============================================

-- 1. Create school_settings table (Singleton)
CREATE TABLE IF NOT EXISTS school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL DEFAULT 'My School',
  logo_url TEXT,
  stamp_url TEXT,
  auto_attach_stamp BOOLEAN DEFAULT false,
  transcript_theme TEXT DEFAULT 'Modern',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enforce Singleton (Only one row allowed)
CREATE UNIQUE INDEX IF NOT EXISTS only_one_row ON school_settings((TRUE));

-- 3. Seed initial row
INSERT INTO school_settings (school_name, transcript_theme)
VALUES ('EduFlow Academy', 'Modern')
ON CONFLICT DO NOTHING;

-- 4. Enable RLS
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Everyone can view settings (for transcripts/dashboard)
CREATE POLICY "Public read access"
  ON school_settings FOR SELECT
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update settings"
  ON school_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admins can insert (only if table is empty, enforced by unique index anyway)
CREATE POLICY "Admins can insert settings"
  ON school_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 6. Storage Bucket for School Assets
-- Note: This usually requires manual setup in Supabase dashboard or via API,
-- but we can try to insert into storage.buckets if permissions allow.
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access to School Assets"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'school-assets' );

CREATE POLICY "Admins can upload School Assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'school-assets' 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update School Assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'school-assets' 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete School Assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'school-assets' 
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
