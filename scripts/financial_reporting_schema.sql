-- ============================================================
-- Financial Reporting Schema — Autonomous Report Engine
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Event Report Status (deduplication + pipeline tracking)
CREATE TABLE IF NOT EXISTS event_report_status (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         UUID REFERENCES tuition_events(id) ON DELETE CASCADE,
    status           TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','generating','generated','failed','sent')),
    error_message    TEXT,
    attempt_count    INT DEFAULT 0,
    triggered_at     TIMESTAMPTZ DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    UNIQUE(event_id)
);

ALTER TABLE event_report_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins full access event_report_status" ON event_report_status;
CREATE POLICY "Admins full access event_report_status"
  ON event_report_status FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Extended Finance Reports Archive
DROP TABLE IF EXISTS finance_reports_archive;
CREATE TABLE IF NOT EXISTS finance_reports_archive (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID REFERENCES tuition_events(id) ON DELETE SET NULL,
    event_name          TEXT,
    report_type         TEXT NOT NULL DEFAULT 'event_completion',
    pdf_url             TEXT,
    csv_url             TEXT,
    financial_summary   JSONB,   -- key metrics snapshot
    status              TEXT DEFAULT 'generated' CHECK (status IN ('generated','sent','archived')),
    sent_via_email      BOOLEAN DEFAULT FALSE,
    sent_via_whatsapp   BOOLEAN DEFAULT FALSE,
    recipient_email     TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    created_by          UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_archive_event ON finance_reports_archive(event_id);
CREATE INDEX IF NOT EXISTS idx_reports_archive_date  ON finance_reports_archive(created_at DESC);

ALTER TABLE finance_reports_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins full access finance_reports" ON finance_reports_archive;
CREATE POLICY "Admins full access finance_reports"
  ON finance_reports_archive FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Ensure tuition_events has expected_revenue column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='tuition_events' AND column_name='expected_revenue') THEN
    ALTER TABLE tuition_events ADD COLUMN expected_revenue NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON event_report_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON finance_reports_archive TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_report_status TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON finance_reports_archive TO service_role;
