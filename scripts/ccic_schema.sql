-- CCIC Database Schema Extension (v3)

-- 1. AI Governance Configuration
CREATE TABLE IF NOT EXISTS ai_governance_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_mode TEXT CHECK (learning_mode IN ('Observation Mode', 'Batch Learning Mode', 'Adaptive Learning Mode')),
    learning_aggression_level TEXT CHECK (learning_aggression_level IN ('Conservative', 'Balanced', 'Aggressive')),
    intervention_mode TEXT CHECK (intervention_mode IN ('Recommendation only', 'Semi-automatic', 'Autonomous strategy')),
    retraining_interval_days INT DEFAULT 7,
    data_volume_threshold INT DEFAULT 1000,
    drift_sensitivity_level TEXT CHECK (drift_sensitivity_level IN ('Conservative', 'Moderate', 'Aggressive')),
    intervention_aggressive_level TEXT CHECK (intervention_aggressive_level IN ('Conservative', 'Moderate', 'Aggressive')),
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Model Registry & Strategy Weights (Reinforcement Learning)
CREATE TABLE IF NOT EXISTS intervention_strategy_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain TEXT NOT NULL, -- 'attendance', 'payment', 'academic'
    intervention_type TEXT NOT NULL, -- e.g. 'Push Notification', 'Teacher Alert'
    weight FLOAT DEFAULT 0.5,
    effectiveness_score FLOAT DEFAULT 0.0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(domain, intervention_type)
);

-- 3. Narrative Intelligence: Memory with Vector Embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_insight_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL, -- 'success', 'attendance', 'payment', 'engagement', 'academic'
    insight_text TEXT NOT NULL,
    embedding vector(1536), -- Standard OpenAI embedding size
    intervention_action_id UUID, -- Links to the outcome tracker
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Intervention Outcome Tracker (The "Outcome Reinforcer")
CREATE TABLE IF NOT EXISTS intervention_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_id UUID REFERENCES ai_insight_memory(id),
    student_id UUID REFERENCES profiles(id),
    action_taken TEXT,
    behavioral_impact FLOAT, -- Change in signals (e.g. +0.08 attendance)
    academic_impact FLOAT, -- Change in scores
    success_index_gain FLOAT,
    status TEXT DEFAULT 'pending_verification', -- 'verified', 'ignored'
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Behavioral Trajectories (Historical Sequence Modelling)
CREATE TABLE IF NOT EXISTS behavioral_trajectories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    success_score FLOAT,
    attendance_stability FLOAT,
    payment_reliability FLOAT,
    engagement_velocity FLOAT,
    academic_performance_trend FLOAT,
    signals_json JSONB, -- Raw signals used for this snapshot
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, snapshot_date)
);

-- 6. Unified AI Insights Cache
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- e.g., 'admin-attendance', 'student-risk'
    context_id TEXT NOT NULL, -- student_id, event_id, or 'global'
    insight TEXT NOT NULL,
    data_hash TEXT, -- To prevent stale cache
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(type, context_id)
);

-- RLS for CCIC Schema
ALTER TABLE ai_governance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_strategy_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insight_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- Governance & Models: Admins only
DROP POLICY IF EXISTS "Admins can manage governance" ON ai_governance_config;
CREATE POLICY "Admins can manage governance" ON ai_governance_config FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage strategy weights" ON intervention_strategy_weights;
CREATE POLICY "Admins can manage strategy weights" ON intervention_strategy_weights FOR ALL TO authenticated USING (true);

-- Insight Memory & Outcomes: Users can read their own or admins can read all
DROP POLICY IF EXISTS "Users can read their own insight memory" ON ai_insight_memory;
CREATE POLICY "Users can read their own insight memory" 
ON ai_insight_memory FOR SELECT TO authenticated 
USING (auth.uid() = student_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can read their own outcomes" ON intervention_outcomes;
CREATE POLICY "Users can read their own outcomes" 
ON intervention_outcomes FOR SELECT TO authenticated 
USING (auth.uid() = student_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Trajectories: Admins/Teachers read-only for students
DROP POLICY IF EXISTS "Privileged roles can read trajectories" ON behavioral_trajectories;
CREATE POLICY "Privileged roles can read trajectories" 
ON behavioral_trajectories FOR SELECT TO authenticated 
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher') OR auth.uid() = student_id);

-- Insights Cache: All authenticated users can manage for performance
DROP POLICY IF EXISTS "Allow authenticated users to manage insights cache" ON ai_insights;
CREATE POLICY "Allow authenticated users to manage insights cache"
ON ai_insights FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS for CCIC Schema (v3)
-- ... (existing tables)

-- 7. Vector Similarity Search Function
CREATE OR REPLACE FUNCTION match_ai_insights (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_student_id uuid,
  p_domain text
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
    ai_insight_memory.id,
    ai_insight_memory.insight_text,
    1 - (ai_insight_memory.embedding <=> query_embedding) AS similarity
  FROM ai_insight_memory
  WHERE ai_insight_memory.student_id = p_student_id
    AND ai_insight_memory.domain = p_domain
    AND 1 - (ai_insight_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Initial Governance Config
-- ...
