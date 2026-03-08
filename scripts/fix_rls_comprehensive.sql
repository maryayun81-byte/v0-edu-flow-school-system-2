-- ============================================================
-- MASTER RLS FIX — Run this entire script in Supabase SQL Editor
-- Fixes: transcripts visibility, quiz auth, behavioral_trajectories 403
-- ============================================================

-- ─── 1. EXAMS: Allow students to see closed/finalized exams ─────────────────
-- (Needed for transcript join to work)
DROP POLICY IF EXISTS "Students can view active exams" ON exams;
DROP POLICY IF EXISTS "Students can view active and closed exams" ON exams;
CREATE POLICY "Students can view active and closed exams"
  ON exams FOR SELECT
  USING (status IN ('Active', 'Closed', 'Finalized'));

-- ─── 2. TRANSCRIPTS: Students see own published transcripts ─────────────────
DROP POLICY IF EXISTS "Students can view their published transcripts" ON transcripts;
DROP POLICY IF EXISTS "Students can view own transcripts" ON transcripts;
CREATE POLICY "Students can view own published transcripts"
  ON transcripts FOR SELECT
  USING (student_id = auth.uid() AND status = 'Published');

-- ─── 3. BEHAVIORAL TRAJECTORIES: Allow student INSERT/UPSERT ────────────────
-- This is the cause of the 403 on POST /rest/v1/behavioral_trajectories
DROP POLICY IF EXISTS "Privileged roles can read trajectories" ON behavioral_trajectories;
DROP POLICY IF EXISTS "Students can read own trajectories" ON behavioral_trajectories;
DROP POLICY IF EXISTS "Students can insert own trajectories" ON behavioral_trajectories;

-- Allow students to read their own trajectory snapshots
CREATE POLICY "Students can read own trajectories"
  ON behavioral_trajectories FOR SELECT
  USING (student_id = auth.uid() OR 
         (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher'));

-- Allow students to write their own trajectory snapshots (for AI engine)
CREATE POLICY "Students can insert own trajectories"
  ON behavioral_trajectories FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Allow the upsert (update) path used by TrajectoryForecaster.recordTrajectory
CREATE POLICY "Students can update own trajectories"
  ON behavioral_trajectories FOR UPDATE
  USING (student_id = auth.uid());

-- ─── 4. INTELLIGENCE INSIGHTS: Allow read + write for cache ─────────────────
DROP POLICY IF EXISTS "Admins full access intelligence_insights" ON intelligence_insights;
DROP POLICY IF EXISTS "Users read own intelligence_insights" ON intelligence_insights;

CREATE POLICY "Admins full access intelligence_insights" 
  ON intelligence_insights FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Students can read and write own insights"
  ON intelligence_insights FOR ALL
  USING (entity_id = auth.uid())
  WITH CHECK (entity_id = auth.uid());

-- ─── 5. QUIZ ATTEMPTS: Allow students to insert/update their own attempts ────
-- (Some Supabase setups are missing this policy)
DROP POLICY IF EXISTS "Students can manage own quiz attempts" ON quiz_attempts;
CREATE POLICY "Students can manage own quiz attempts"
  ON quiz_attempts FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ─── 6. SUBMISSION_ANSWERS: Students can insert their own answers ────────────
DROP POLICY IF EXISTS "Students can manage own submission answers" ON submission_answers;
CREATE POLICY "Students can manage own submission answers"
  ON submission_answers FOR ALL
  USING (
    submission_id IN (
      SELECT id FROM student_submissions WHERE student_id = auth.uid()
    )
  )
  WITH CHECK (
    submission_id IN (
      SELECT id FROM student_submissions WHERE student_id = auth.uid()
    )
  );

-- ─── 7. STUDENT SUBMISSIONS: Students can insert/read own submissions ─────────
DROP POLICY IF EXISTS "Students can manage own submissions" ON student_submissions;
CREATE POLICY "Students can manage own submissions"
  ON student_submissions FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
