-- ============================================================
-- CCIC Production Schema — Platform Events & Intelligence
-- ============================================================
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS

-- 1. Platform Events
-- Stores all raw behavioral events from the platform.
CREATE TABLE IF NOT EXISTS platform_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL CHECK (event_type IN ('attendance', 'payment', 'assessment', 'engagement')),
    event_reference TEXT,           -- Foreign key reference e.g. session_id, payment_id
    value           NUMERIC(10, 4), -- Normalized signal value (0-1)
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_student    ON platform_events(student_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_type       ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_created    ON platform_events(created_at);

-- 2. Intelligence Features
-- Computed behavioral metrics per student per period.
CREATE TABLE IF NOT EXISTS intelligence_features (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
    feature_name    TEXT NOT NULL,   -- e.g. 'attendance_rate_14d', 'payment_delay_mean', 'assessment_trend'
    feature_value   NUMERIC(10, 4),
    period          TEXT,            -- e.g. '2024-Term1', '2024-03-W1'
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, feature_name, period)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_features_student ON intelligence_features(student_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_features_name    ON intelligence_features(feature_name);

-- 3. Intelligence Insights
-- Precomputed, dashboard-ready insights indexed by entity.
CREATE TABLE IF NOT EXISTS intelligence_insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('student', 'teacher', 'platform')),
    entity_id       UUID,
    insight_text    TEXT NOT NULL,
    insight_type    TEXT NOT NULL CHECK (insight_type IN ('attendance', 'finance', 'academic', 'success', 'platform')),
    confidence      FLOAT DEFAULT 0.75,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_entity ON intelligence_insights(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_type   ON intelligence_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_date   ON intelligence_insights(created_at);

-- 4. Insight Memory Vectors (for anti-repetition)
-- Requires pgvector extension.
CREATE TABLE IF NOT EXISTS insight_memory_vectors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_text    TEXT NOT NULL,
    insight_embedding vector(1536),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_memory_date ON insight_memory_vectors(created_at);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE platform_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_features    ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_insights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_memory_vectors   ENABLE ROW LEVEL SECURITY;

-- platform_events
DROP POLICY IF EXISTS "Admins full access platform_events"           ON platform_events;
DROP POLICY IF EXISTS "Students read own platform_events"            ON platform_events;
CREATE POLICY "Admins full access platform_events"    ON platform_events    FOR ALL    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Students read own platform_events"     ON platform_events    FOR SELECT USING (student_id = auth.uid());

-- intelligence_features
DROP POLICY IF EXISTS "Admins full access intelligence_features"     ON intelligence_features;
DROP POLICY IF EXISTS "Students read own intelligence_features"      ON intelligence_features;
CREATE POLICY "Admins full access intelligence_features" ON intelligence_features FOR ALL    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Students read own intelligence_features"  ON intelligence_features FOR SELECT USING (student_id = auth.uid());

-- intelligence_insights
DROP POLICY IF EXISTS "Admins full access intelligence_insights"     ON intelligence_insights;
DROP POLICY IF EXISTS "Users read own intelligence_insights"         ON intelligence_insights;
CREATE POLICY "Admins full access intelligence_insights" ON intelligence_insights FOR ALL    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users read own intelligence_insights"     ON intelligence_insights FOR SELECT USING (entity_id = auth.uid());

-- insight_memory_vectors
DROP POLICY IF EXISTS "Admins full access insight_memory_vectors"   ON insight_memory_vectors;
CREATE POLICY "Admins full access insight_memory_vectors" ON insight_memory_vectors FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── Semantic Similarity Search Function ──────────────────────────────────────

CREATE OR REPLACE FUNCTION match_insight_memory (
    query_embedding vector(1536),
    match_threshold float,
    match_count     int
)
RETURNS TABLE (id uuid, insight_text text, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        insight_memory_vectors.id,
        insight_memory_vectors.insight_text,
        1 - (insight_memory_vectors.insight_embedding <=> query_embedding) AS similarity
    FROM insight_memory_vectors
    WHERE 1 - (insight_memory_vectors.insight_embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
