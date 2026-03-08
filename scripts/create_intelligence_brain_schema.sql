-- Superintelligent Unified Education Intelligence Platform Brain Schema
-- Core tables for ML Governance, Behavioral Signals, and Success Prediction

-- 1. ML Model Registry
CREATE TABLE IF NOT EXISTS ml_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    domain TEXT NOT NULL, -- attendance, finance, academic, dropout
    training_timestamp TIMESTAMPTZ DEFAULT NOW(),
    dataset_hash TEXT,
    evaluation_metrics JSONB, -- {accuracy: 0.95, f1: 0.92, etc}
    deployment_status TEXT DEFAULT 'candidate', -- candidate, active, retired
    is_active_model BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one active model per domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_model_per_domain 
ON ml_model_registry (domain) 
WHERE (is_active_model = TRUE);

-- 2. AI Governance Configuration
CREATE TABLE IF NOT EXISTS ai_governance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_mode TEXT DEFAULT 'Observation Mode', -- Observation, Batch, Adaptive
    retraining_interval_days INTEGER DEFAULT 7,
    data_volume_threshold INTEGER DEFAULT 1000,
    drift_sensitivity_level TEXT DEFAULT 'Moderate', -- Conservative, Moderate, Aggressive
    intervention_aggressive_level TEXT DEFAULT 'Moderate',
    is_active BOOLEAN DEFAULT TRUE,
    last_updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Behavioral and Academic Signals (Aggregated for Engine)
CREATE TABLE IF NOT EXISTS intelligence_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    
    -- Attendance Signals
    attendance_rate DECIMAL DEFAULT 1.0,
    attendance_volatility DECIMAL DEFAULT 0,
    absence_streak INTEGER DEFAULT 0,
    lateness_pattern_score DECIMAL DEFAULT 0,
    
    -- Finance Signals
    payment_completion_ratio DECIMAL DEFAULT 1.0,
    payment_delay_days INTEGER DEFAULT 0,
    outstanding_balance DECIMAL DEFAULT 0,
    
    -- Engagement Signals
    focus_duration_avg INTEGER DEFAULT 0, -- minutes
    assignment_completion_rate DECIMAL DEFAULT 1.0,
    engagement_velocity DECIMAL DEFAULT 1.0,
    
    -- Academic Signals
    academic_performance_avg DECIMAL DEFAULT 0,
    score_volatility DECIMAL DEFAULT 0,
    improvement_gradient DECIMAL DEFAULT 0,
    
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id)
);

-- 4. Student Success Index & Predictions
CREATE TABLE IF NOT EXISTS student_success_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    
    -- Success Score
    success_score DECIMAL NOT NULL, -- 0-1
    classification_zone TEXT NOT NULL, -- Critical, Monitoring, Healthy, Elite
    
    -- Specific Predictions
    attendance_risk_prob DECIMAL,
    payment_risk_prob DECIMAL,
    dropout_risk_prob DECIMAL,
    expected_exam_score_range TEXT, -- e.g. "85-90"
    improvement_prob DECIMAL,
    
    -- Explainability
    top_contributing_factors JSONB,
    insight_narrative TEXT,
    
    model_version TEXT, -- reference to ml_model_registry
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI Insight Memory (For deduplication)
CREATE TABLE IF NOT EXISTS ai_insight_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    domain TEXT NOT NULL,
    insight_text TEXT NOT NULL,
    embedding_vector VECTOR(1536), -- Assuming OpenAI/Supabase vector size
    similarity_hash TEXT, -- Fallback for basic deduplication
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_signals_student_id ON intelligence_signals(student_id);
CREATE INDEX IF NOT EXISTS idx_predictions_student_id ON student_success_predictions(student_id);
CREATE INDEX IF NOT EXISTS idx_memory_student_domain ON ai_insight_memory(student_id, domain);

-- RLS Policies (Basic Admin access)
ALTER TABLE ml_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_governance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_success_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insight_memory ENABLE ROW LEVEL SECURITY;

-- Simple policy: Admins can do anything
CREATE POLICY admin_full_access ON ml_model_registry TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY admin_full_access ON ai_governance_config TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY admin_full_access ON intelligence_signals TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY admin_full_access ON student_success_predictions TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY admin_full_access ON ai_insight_memory TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
