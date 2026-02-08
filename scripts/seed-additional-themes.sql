-- Seed Additional Themes

-- 1. Midnight Dark (Global)
INSERT INTO transcript_themes (name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    'Midnight Dark',
    false,
    'ALL',
    '{"primary": "#60a5fa", "secondary": "#94a3b8", "accent": "#3b82f6", "text": "#f8fafc", "background": "#1e293b"}',
    '{"header": "Inter", "body": "Inter", "table": "Inter"}',
    '{"header_style": "minimal", "table_style": "cards", "footer_style": "standard", "show_border": false, "show_watermark": false}'
);

-- 2. CBC Nature (CBC Specific)
INSERT INTO transcript_themes (name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    'CBC Nature',
    false,
    'CBC',
    '{"primary": "#166534", "secondary": "#15803d", "accent": "#dcfce7", "text": "#052e16", "background": "#f0fdf4"}',
    '{"header": "Helvetica", "body": "Helvetica", "table": "Helvetica"}',
    '{"header_style": "modern", "table_style": "shaded_rows", "footer_style": "standard", "show_border": true, "show_watermark": true}'
);

-- 3. 8-4-4 Academy (8-4-4 Specific)
INSERT INTO transcript_themes (name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    '8-4-4 Academy',
    false,
    '8-4-4',
    '{"primary": "#1e40af", "secondary": "#94a3b8", "accent": "#dbeafe", "text": "#0f172a", "background": "#eff6ff"}',
    '{"header": "Times", "body": "Times", "table": "Times"}',
    '{"header_style": "centered_logo", "table_style": "lines", "footer_style": "stamp_emphasis", "show_border": true, "show_watermark": true}'
);

-- 4. Elegant Paper (Global)
INSERT INTO transcript_themes (name, is_default, target_curriculum, colors, fonts, layout)
VALUES (
    'Elegant Paper',
    false,
    'ALL',
    '{"primary": "#78350f", "secondary": "#a8a29e", "accent": "#f5f5f4", "text": "#292524", "background": "#fafaf9"}',
    '{"header": "Playfair Display", "body": "Georgia", "table": "Georgia"}',
    '{"header_style": "flat_bar", "table_style": "grid", "footer_style": "standard", "show_border": true, "show_watermark": true}'
);
