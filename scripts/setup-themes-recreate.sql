-- ========================================
-- RESET & RECREATE TRANSCRIPT THEMES
-- Warning: This will delete existing themes!
-- ========================================

-- 1. Drop Table Cleanly
DROP TABLE IF EXISTS transcript_themes CASCADE;

-- 2. Create Extension (just in case)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create Table (Fresh Definition)
CREATE TABLE transcript_themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    target_curriculum TEXT DEFAULT 'ALL', -- 'ALL', 'CBC', '8-4-4'
    
    colors JSONB DEFAULT '{
        "primary": "#000000",
        "secondary": "#666666",
        "accent": "#000000",
        "text": "#000000",
        "background": "#ffffff"
    }'::jsonb,
    
    fonts JSONB DEFAULT '{
        "header": "Helvetica",
        "body": "Helvetica",
        "table": "Helvetica"
    }'::jsonb,
    
    layout JSONB DEFAULT '{
        "header_style": "modern",
        "table_style": "lines",
        "footer_style": "standard",
        "show_border": true,
        "show_watermark": true
    }'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS & Policies
ALTER TABLE transcript_themes ENABLE ROW LEVEL SECURITY;

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

-- 5. Insert ALL 8 Seed Themes

-- 1. Classic Academic (8-4-4 Default)
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Classic Academic (8-4-4)',
    true,
    '8-4-4',
    '{"primary": "#1F2A44", "secondary": "#4A4A4A", "accent": "#C9A24D", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Times", "body": "Georgia", "table": "Georgia"}',
    '{"header_style": "centered_logo", "table_style": "strong_borders", "footer_style": "formal", "show_border": true, "show_watermark": true}'
);

-- 2. Modern Institutional (CBC Default)
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Modern Institutional (CBC)',
    true,
    'CBC',
    '{"primary": "#2B4EFF", "secondary": "#6B7280", "accent": "#2DD4BF", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Inter", "body": "Inter", "table": "Inter"}',
    '{"header_style": "flat_bar", "table_style": "minimal_dividers", "footer_style": "hierarchical", "show_border": false, "show_watermark": false}'
);

-- 3. Minimal Prestige (Global Default option)
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000003',
    'Minimal Prestige',
    false,
    'ALL',
    '{"primary": "#111827", "secondary": "#9CA3AF", "accent": "#D4AF37", "text": "#111827", "background": "#FAFAFA"}',
    '{"header": "Playfair Display", "body": "Source Serif Pro", "table": "Source Serif Pro"}',
    '{"header_style": "typography_first", "table_style": "soft_separators", "footer_style": "spacious", "show_border": false, "show_watermark": false}'
);

-- 4. Government Standard
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000004',
    'Government Standard',
    false,
    'ALL',
    '{"primary": "#14532D", "secondary": "#475569", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Arial", "body": "Arial", "table": "Arial"}',
    '{"header_style": "grid_alignment", "table_style": "grid", "footer_style": "stamp_emphasis", "show_border": true, "show_watermark": true}'
);

-- 5. Scholarly Blue
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000005',
    'Scholarly Blue',
    false,
    'ALL',
    '{"primary": "#1E3A8A", "secondary": "#64748B", "accent": "#93C5FD", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Merriweather", "body": "Lora", "table": "Lora"}',
    '{"header_style": "subtle_band", "table_style": "shaded_rows", "footer_style": "standard", "show_border": true, "show_watermark": false}'
);

-- 6. Elegant Neutral
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000006',
    'Elegant Neutral',
    false,
    'ALL',
    '{"primary": "#3F3F46", "secondary": "#A1A1AA", "accent": "#E7E5E4", "text": "#000000", "background": "#ffffff"}',
    '{"header": "IBM Plex Serif", "body": "IBM Plex Sans", "table": "IBM Plex Sans"}',
    '{"header_style": "hybrid", "table_style": "contrast", "footer_style": "clean", "show_border": true, "show_watermark": false}'
);

-- 7. Premium Crest
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000007',
    'Premium Crest',
    false,
    'ALL',
    '{"primary": "#7F1D1D", "secondary": "#27272A", "accent": "#B89B5E", "text": "#000000", "background": "#FFFDF8"}',
    '{"header": "Cinzel", "body": "Crimson Pro", "table": "Crimson Pro"}',
    '{"header_style": "crest_focus", "table_style": "decorative_dividers", "footer_style": "ceremonial", "show_border": true, "show_watermark": true}'
);

-- 8. Clean Monochrome
INSERT INTO transcript_themes (id, name, is_default, target_curriculum, colors, fonts, layout) VALUES (
    '00000000-0000-0000-0000-000000000008',
    'Clean Monochrome',
    false,
    'ALL',
    '{"primary": "#000000", "secondary": "#525252", "accent": "#E5E7EB", "text": "#000000", "background": "#ffffff"}',
    '{"header": "Helvetica", "body": "Helvetica", "table": "Helvetica"}',
    '{"header_style": "zero_distraction", "table_style": "clear", "footer_style": "simple", "show_border": false, "show_watermark": false}'
);
