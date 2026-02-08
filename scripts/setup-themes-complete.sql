-- ========================================
-- COMPLETE THEME SETUP SCRIPT
-- Run this to fix "No themes found" issues
-- ========================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Table (if not exists)
CREATE TABLE IF NOT EXISTS transcript_themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    target_curriculum TEXT DEFAULT 'ALL', 
    colors JSONB DEFAULT '{}'::jsonb,
    fonts JSONB DEFAULT '{}'::jsonb,
    layout JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure Columns Exist (Idempotent Migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcript_themes' AND column_name = 'target_curriculum') THEN
        ALTER TABLE transcript_themes ADD COLUMN target_curriculum TEXT DEFAULT 'ALL';
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE transcript_themes ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Drop first to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage themes" ON transcript_themes;
DROP POLICY IF EXISTS "Authenticated users can read themes" ON transcript_themes;

CREATE POLICY "Admins can manage themes" ON transcript_themes
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "Authenticated users can read themes" ON transcript_themes
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 6. Insert Seed Data (Upsert)

-- 1. Classic Academic (8-4-4)
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Classic Academic (8-4-4)',
    true,
    '8-4-4',
    '{"primary": "#1F2A44", "secondary": "#4A4A4A", "accent": "#C9A24D", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Times", "body": "Georgia", "table": "Georgia"}',
    '{"header_style": "centered_logo", "table_style": "strong_borders", "footer_style": "formal", "show_border": true, "show_watermark": true}'
) ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, colors = EXCLUDED.colors, fonts = EXCLUDED.fonts, layout = EXCLUDED.layout, target_curriculum = EXCLUDED.target_curriculum;

-- 2. Modern Institutional (CBC)
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Modern Institutional (CBC)',
    true,
    'CBC',
    '{"primary": "#2B4EFF", "secondary": "#6B7280", "accent": "#2DD4BF", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Inter", "body": "Inter", "table": "Inter"}',
    '{"header_style": "flat_bar", "table_style": "minimal_dividers", "footer_style": "hierarchical", "show_border": false, "show_watermark": false}'
) ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, colors = EXCLUDED.colors, fonts = EXCLUDED.fonts, layout = EXCLUDED.layout, target_curriculum = EXCLUDED.target_curriculum;

-- 3. Minimal Prestige
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'Minimal Prestige',
    false,
    'ALL',
    '{"primary": "#111827", "secondary": "#9CA3AF", "accent": "#D4AF37", "text": "#111827", "background": "#FAFAFA"}',
    '{"header": "Playfair Display", "body": "Source Serif Pro", "table": "Source Serif Pro"}',
    '{"header_style": "typography_first", "table_style": "soft_separators", "footer_style": "spacious", "show_border": false, "show_watermark": false}'
) ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, colors = EXCLUDED.colors, fonts = EXCLUDED.fonts, layout = EXCLUDED.layout, target_curriculum = EXCLUDED.target_curriculum;
