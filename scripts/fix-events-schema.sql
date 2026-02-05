-- ============================================
-- Fix Events Table Schema
-- Run this in Supabase SQL Editor to fix the events table mismatch
-- ============================================

-- Drop the old events table if it exists (this will cascade delete registrations)
-- WARNING: This will delete existing event data. Backup first if you have important data.
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- Create events table with correct schema matching EventManager.tsx
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('academic', 'sports', 'cultural', 'meeting', 'holiday', 'other')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  is_mandatory BOOLEAN DEFAULT FALSE,
  max_participants INTEGER,
  registration_deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create event_registrations table with correct schema
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled', 'attended')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user ON event_registrations(user_id);
CREATE INDEX idx_event_registrations_status ON event_registrations(status);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Events
DROP POLICY IF EXISTS "Everyone can view events" ON events;
CREATE POLICY "Everyone can view events" ON events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and teachers can create events" ON events;
CREATE POLICY "Admins and teachers can create events" ON events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Admins and teachers can update events" ON events;
CREATE POLICY "Admins and teachers can update events" ON events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'teacher')
    )
  );

DROP POLICY IF EXISTS "Admins can delete events" ON events;
CREATE POLICY "Admins can delete events" ON events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for Event Registrations
DROP POLICY IF EXISTS "Everyone can view registrations" ON event_registrations;
CREATE POLICY "Everyone can view registrations" ON event_registrations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can register for events" ON event_registrations;
CREATE POLICY "Users can register for events" ON event_registrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can cancel their own registrations" ON event_registrations;
CREATE POLICY "Users can cancel their own registrations" ON event_registrations
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all registrations" ON event_registrations;
CREATE POLICY "Admins can manage all registrations" ON event_registrations
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Events table schema has been fixed successfully!';
END $$;
