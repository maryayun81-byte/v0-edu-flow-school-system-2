-- ============================================================
-- Peak Performance Tutoring – Advanced Finance System Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. PPT PAYMENTS TABLE
-- Links to existing tuition_events (from attendance module)
-- and profiles (students)
CREATE TABLE IF NOT EXISTS ppt_payments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_name        TEXT NOT NULL,
  student_admission   TEXT,
  event_id            UUID REFERENCES tuition_events(id) ON DELETE SET NULL,
  event_name          TEXT,
  payment_type        TEXT NOT NULL DEFAULT 'tuition_fee'
                        CHECK (payment_type IN ('tuition_fee','deposit','balance_payment','materials','other')),
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method      TEXT NOT NULL DEFAULT 'mpesa'
                        CHECK (payment_method IN ('mpesa','cash','bank_transfer','card','other')),
  transaction_ref     TEXT,
  payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'paid'
                        CHECK (status IN ('paid','pending','partial','refunded')),
  receipt_number      TEXT UNIQUE,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PPT RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS ppt_receipts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number  TEXT UNIQUE NOT NULL,
  payment_id      UUID REFERENCES ppt_payments(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_name    TEXT NOT NULL,
  event_name      TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  payment_method  TEXT NOT NULL,
  transaction_ref TEXT,
  payment_date    DATE NOT NULL,
  remaining_balance NUMERIC(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published')),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_ppt_payments_student_id    ON ppt_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_ppt_payments_event_id      ON ppt_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_ppt_payments_payment_date  ON ppt_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_ppt_payments_transaction_ref ON ppt_payments(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_ppt_payments_status        ON ppt_payments(status);
CREATE INDEX IF NOT EXISTS idx_ppt_receipts_student_id    ON ppt_receipts(student_id);
CREATE INDEX IF NOT EXISTS idx_ppt_receipts_status        ON ppt_receipts(status);

-- 4. ROW LEVEL SECURITY
ALTER TABLE ppt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppt_receipts ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admin full access payments" ON ppt_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin full access receipts" ON ppt_receipts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Students can view their own receipts (published only)
CREATE POLICY "Students view own receipts" ON ppt_receipts
  FOR SELECT USING (
    student_id = auth.uid() AND status = 'published'
  );

-- Students can view their own payments
CREATE POLICY "Students view own payments" ON ppt_payments
  FOR SELECT USING (student_id = auth.uid());
