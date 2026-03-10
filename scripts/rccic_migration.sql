-- ============================================================
-- RCCIC 2.0 + CCIC Behavioral Intelligence Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add tuition_event_id to exams table
--    Links an exam to the tuition event it was conducted within.
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS tuition_event_id uuid REFERENCES tuition_events(id) ON DELETE SET NULL;

-- 2. Per-student per-event insight storage (primary insight store)
CREATE TABLE IF NOT EXISTS rccic_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES tuition_events(id) ON DELETE CASCADE,
  insight_type  text NOT NULL, -- 'subject_performance' | 'overall_trend' | 'exam_comparison' | 'behavioral' | 'strength' | 'momentum'
  subject       text,          -- populated for subject-specific insights
  insight_text  text NOT NULL,
  insight_hash  text NOT NULL, -- sha-style hash of first 80 chars (normalized)
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rccic_insights_student_event ON rccic_insights(student_id, event_id);

-- 3. Cross-student uniqueness registry — prevents same insight going to different students
CREATE TABLE IF NOT EXISTS student_insight_registry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES tuition_events(id) ON DELETE CASCADE,
  insight_hash  text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(insight_hash) -- globally unique hashes; if collision on different student, regenerate
);

-- 4. Results insights memory (anti-repetition for individual student over time)
CREATE TABLE IF NOT EXISTS results_insights_memory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_id      uuid REFERENCES tuition_events(id) ON DELETE CASCADE,
  subject       text,
  insight_text  text NOT NULL,
  insight_hash  text NOT NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS results_insights_memory_student ON results_insights_memory(student_id);

-- 5. CCIC behavioral insight memory (deduplication for behavioral insights)
CREATE TABLE IF NOT EXISTS ccic_insight_memory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  insight_text  text NOT NULL,
  insight_hash  text NOT NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccic_insight_memory_student ON ccic_insight_memory(student_id);

-- ============================================================
-- RLS Policies (enable Row Level Security)
-- ============================================================

ALTER TABLE rccic_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_insight_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE results_insights_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccic_insight_memory ENABLE ROW LEVEL SECURITY;

-- Students can only read their own insights
CREATE POLICY "Students read own rccic_insights" ON rccic_insights
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Service role full access rccic_insights" ON rccic_insights
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access results_insights_memory" ON results_insights_memory
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access ccic_insight_memory" ON ccic_insight_memory
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access student_insight_registry" ON student_insight_registry
  FOR ALL USING (true) WITH CHECK (true);
