-- Ensure school_settings table exists and has all required columns
CREATE TABLE IF NOT EXISTS school_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_name TEXT NOT NULL DEFAULT 'My School',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS stamp_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS auto_attach_stamp BOOLEAN DEFAULT false;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS auto_attach_signature BOOLEAN DEFAULT false;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS transcript_theme TEXT DEFAULT 'Modern';

-- Force schema cache reload (sometimes needed for PostgREST)
NOTIFY pgrst, 'reload config';
