-- ============================================
-- EduFlow LMS - Events & Financial Management
-- ============================================

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('standard', 'registration', 'premium')),
  price DECIMAL(10, 2) DEFAULT 0,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  max_participants INTEGER,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Registrations Table
CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  admission_number TEXT,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_amount DECIMAL(10, 2) DEFAULT 0,
  payment_date TIMESTAMP WITH TIME ZONE,
  registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, student_id)
);

-- Tuition Payments Table (Weekly tracking)
CREATE TABLE IF NOT EXISTS tuition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  admission_number TEXT,
  form_class TEXT,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  amount_expected DECIMAL(10, 2) NOT NULL DEFAULT 0,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 52),
  term TEXT NOT NULL CHECK (term IN ('Term 1', 'Term 2', 'Term 3')),
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  payment_method TEXT,
  receipt_number TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, week_number, term, year)
);

-- Financial Summary View (for analytics)
CREATE OR REPLACE VIEW financial_summary AS
SELECT 
  term,
  year,
  week_number,
  COUNT(DISTINCT student_id) as total_students,
  SUM(amount_expected) as total_expected,
  SUM(amount_paid) as total_collected,
  SUM(amount_expected) - SUM(amount_paid) as total_arrears,
  COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as fully_paid_count,
  COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial_paid_count,
  COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as unpaid_count
FROM tuition_payments
GROUP BY term, year, week_number;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_featured ON events(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_student ON event_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_student ON tuition_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_week ON tuition_payments(week_number, term, year);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Events
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
CREATE POLICY "Events are viewable by everyone" ON events
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage events" ON events;
CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for Event Registrations
DROP POLICY IF EXISTS "Students can view their own registrations" ON event_registrations;
CREATE POLICY "Students can view their own registrations" ON event_registrations
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can register for events" ON event_registrations;
CREATE POLICY "Students can register for events" ON event_registrations
  FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all registrations" ON event_registrations;
CREATE POLICY "Admins can manage all registrations" ON event_registrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for Tuition Payments
DROP POLICY IF EXISTS "Students can view their own payments" ON tuition_payments;
CREATE POLICY "Students can view their own payments" ON tuition_payments
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all payments" ON tuition_payments;
CREATE POLICY "Admins can manage all payments" ON tuition_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE event_registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE tuition_payments;
