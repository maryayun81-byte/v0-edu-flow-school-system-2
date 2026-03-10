-- 1. Enhance tuition_events table
ALTER TABLE tuition_events 
ADD COLUMN IF NOT EXISTS total_seats INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS classes_allowed TEXT[] DEFAULT ARRAY['Form 3', 'Form 4', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'upcoming', 'cancelled', 'draft', 'archived', 'completed')),
ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT true;

-- 2. Create event_registrations table
DROP TABLE IF EXISTS event_registrations;
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES tuition_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    school TEXT NOT NULL,
    phone TEXT,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, event_id)
);

-- 3. Create student_event_ad_views table for frequency capping
DROP TABLE IF EXISTS student_event_ad_views;
CREATE TABLE student_event_ad_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES tuition_events(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 1,
    last_view_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(student_id, event_id, last_view_date)
);

-- 4. Enable RLS
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_event_ad_views ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for event_registrations
CREATE POLICY "Students can view their own registrations"
    ON event_registrations FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Students can register themselves"
    ON event_registrations FOR INSERT
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can view all registrations"
    ON event_registrations FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. RLS Policies for student_event_ad_views
CREATE POLICY "Students can manage their own ad views"
    ON student_event_ad_views FOR ALL
    USING (student_id = auth.uid());

-- 7. Grant permissions
GRANT ALL ON event_registrations TO authenticated;
GRANT ALL ON student_event_ad_views TO authenticated;
GRANT ALL ON event_registrations TO service_role;
GRANT ALL ON student_event_ad_views TO service_role;
