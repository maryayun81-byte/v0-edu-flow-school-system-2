-- Fix RLS for audit_logs and intelligence_insights
-- 1. audit_logs: allow users to view their own logs
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (user_id = auth.uid());

-- 2. intelligence_insights: allow users to view insights related to them
-- entity_id for students is their UUID
DROP POLICY IF EXISTS "Users can view their own insights" ON intelligence_insights;
CREATE POLICY "Users can view their own insights" ON intelligence_insights
    FOR SELECT USING (entity_id = auth.uid()::text AND entity_type = 'student');

-- Also allow admins full access (ensure it exists)
DROP POLICY IF EXISTS "Admins can manage intelligence_insights" ON intelligence_insights;
CREATE POLICY "Admins can manage intelligence_insights" ON intelligence_insights
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
