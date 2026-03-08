-- ============================================================
-- Finance Intelligence Module — SQL Schema
-- ============================================================

-- 1. Finance Transactions (Consolidated)
CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES tuition_events(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('mpesa','cash','bank_transfer','card','other')),
    reference_code TEXT UNIQUE,
    status TEXT DEFAULT 'paid' CHECK (status IN ('paid','pending','partial','refunded')),
    transaction_type TEXT DEFAULT 'tuition_fee',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Finance Summary Metrics (Periodic Snapshots)
CREATE TABLE IF NOT EXISTS finance_summary_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period TEXT NOT NULL, -- e.g., '2024-Q1', '2024-Term1'
    total_expected_fee NUMERIC(12,2),
    total_collected_fee NUMERIC(12,2),
    outstanding_balance NUMERIC(12,2),
    collection_ratio FLOAT,
    cashflow_velocity FLOAT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period)
);

-- 3. Finance Intelligence Insights (Vector-enabled)
CREATE TABLE IF NOT EXISTS finance_intelligence_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Optional (can be global)
    insight_text TEXT NOT NULL,
    embedding_vector vector(1536), -- Standard OpenAI/Gemini embedding size
    context_type TEXT NOT NULL, -- 'global', 'student', 'event'
    domain TEXT DEFAULT 'finance',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Finance Events (Log for triggers)
CREATE TABLE IF NOT EXISTS finance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'payment_received', 'fee_event_created', etc.
    student_id UUID REFERENCES profiles(id),
    event_id UUID, 
    amount NUMERIC(12,2),
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Finance AI Configuration
CREATE TABLE IF NOT EXISTS finance_ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_aggressiveness TEXT DEFAULT 'Balanced' CHECK (insight_aggressiveness IN ('Conservative', 'Balanced', 'Advanced')),
    prediction_horizon INT DEFAULT 30, -- 30, 60, 90 days
    cashflow_forecast_depth TEXT DEFAULT 'Medium' CHECK (cashflow_forecast_depth IN ('Low', 'Medium', 'High')),
    auto_insight_generation BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for Performance
CREATE INDEX IF NOT EXISTS idx_finance_transactions_student ON finance_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_timestamp ON finance_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_finance_events_type ON finance_events(event_type);

-- RLS Policies
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_summary_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_intelligence_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access finance_transactions" ON finance_transactions;
CREATE POLICY "Admins full access finance_transactions" ON finance_transactions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins full access finance_summary" ON finance_summary_metrics;
CREATE POLICY "Admins full access finance_summary" ON finance_summary_metrics FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins full access finance_insights" ON finance_intelligence_insights;
CREATE POLICY "Admins full access finance_insights" ON finance_intelligence_insights FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins full access finance_events" ON finance_events;
CREATE POLICY "Admins full access finance_events" ON finance_events FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins full access finance_ai_config" ON finance_ai_config;
CREATE POLICY "Admins full access finance_ai_config" ON finance_ai_config FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Similarity Search Function for Finance Insights
CREATE OR REPLACE FUNCTION match_finance_insights (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_context_type text
)
RETURNS TABLE (
  id uuid,
  insight_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    finance_intelligence_insights.id,
    finance_intelligence_insights.insight_text,
    1 - (finance_intelligence_insights.embedding_vector <=> query_embedding) AS similarity
  FROM finance_intelligence_insights
  WHERE finance_intelligence_insights.context_type = p_context_type
    AND 1 - (finance_intelligence_insights.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 6. Finance Reports Archive
CREATE TABLE IF NOT EXISTS finance_reports_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL,
    filter_parameters JSONB,
    generated_summary TEXT,
    export_format TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- RLS Policies for Reports Archive
ALTER TABLE finance_reports_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins full access finance_reports" ON finance_reports_archive;
CREATE POLICY "Admins full access finance_reports" ON finance_reports_archive FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));


-- Initial Finance AI Config
INSERT INTO finance_ai_config (insight_aggressiveness, prediction_horizon, cashflow_forecast_depth, auto_insight_generation)
VALUES ('Balanced', 30, 'Medium', TRUE)
ON CONFLICT DO NOTHING;
