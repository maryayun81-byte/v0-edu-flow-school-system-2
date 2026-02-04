-- =====================================================
-- TIMETABLE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Admin-only timetable authority with read-only teacher/student views
-- Includes conflict detection, publish/lock workflows, and real-time support
-- =====================================================

-- =====================================================
-- PART 1: CREATE TABLES
-- =====================================================

-- Timetable sessions (individual lessons)
CREATE TABLE IF NOT EXISTS timetable_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  room TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'locked')),
  week_number INTEGER DEFAULT 1,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable metadata (per class)
CREATE TABLE IF NOT EXISTS timetable_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::TEXT,
  term TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'locked')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sessions_class ON timetable_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON timetable_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON timetable_sessions(day_of_week);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON timetable_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_class_day ON timetable_sessions(class_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_day ON timetable_sessions(teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_sessions_class_status ON timetable_sessions(class_id, status);
CREATE INDEX IF NOT EXISTS idx_metadata_class ON timetable_metadata(class_id);

-- =====================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE timetable_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_metadata ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 4: CREATE RLS POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_full_access_sessions" ON timetable_sessions;
DROP POLICY IF EXISTS "teacher_read_own_sessions" ON timetable_sessions;
DROP POLICY IF EXISTS "student_read_class_sessions" ON timetable_sessions;
DROP POLICY IF EXISTS "admin_full_access_metadata" ON timetable_metadata;
DROP POLICY IF EXISTS "teacher_read_metadata" ON timetable_metadata;
DROP POLICY IF EXISTS "student_read_metadata" ON timetable_metadata;

-- TIMETABLE SESSIONS POLICIES

-- Admins have full access
CREATE POLICY "admin_full_access_sessions" ON timetable_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Teachers can view their assigned published/locked sessions
CREATE POLICY "teacher_read_own_sessions" ON timetable_sessions
  FOR SELECT USING (
    teacher_id = auth.uid() 
    AND status IN ('published', 'locked')
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- Students can view their class published/locked sessions
CREATE POLICY "student_read_class_sessions" ON timetable_sessions
  FOR SELECT USING (
    status IN ('published', 'locked')
    AND EXISTS (
      SELECT 1 FROM profiles p
      JOIN classes c ON c.name = p.form_class
      WHERE p.id = auth.uid() 
      AND p.role = 'student'
      AND c.id = timetable_sessions.class_id
    )
  );

-- TIMETABLE METADATA POLICIES

-- Admins have full access
CREATE POLICY "admin_full_access_metadata" ON timetable_metadata
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Teachers can view metadata for classes they teach
CREATE POLICY "teacher_read_metadata" ON timetable_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM timetable_sessions ts
      WHERE ts.class_id = timetable_metadata.class_id
      AND ts.teacher_id = auth.uid()
      AND ts.status IN ('published', 'locked')
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- Students can view metadata for their class
CREATE POLICY "student_read_metadata" ON timetable_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN classes c ON c.name = p.form_class
      WHERE p.id = auth.uid() 
      AND p.role = 'student'
      AND c.id = timetable_metadata.class_id
    )
  );

-- =====================================================
-- PART 5: CONFLICT DETECTION FUNCTIONS
-- =====================================================

-- Check for scheduling conflicts
CREATE OR REPLACE FUNCTION check_timetable_conflicts(
  p_class_id UUID,
  p_teacher_id UUID,
  p_day TEXT,
  p_start TIME,
  p_end TIME,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(
  conflict_type TEXT, 
  conflict_message TEXT,
  conflicting_session_id UUID
) AS $$
BEGIN
  -- Check teacher double booking
  -- Two time ranges overlap if: start1 < end2 AND start2 < end1
  RETURN QUERY
  SELECT 
    'teacher_conflict'::TEXT,
    'Teacher is already scheduled for ' || ts.subject || ' at ' || 
    to_char(ts.start_time, 'HH24:MI') || ' - ' || to_char(ts.end_time, 'HH24:MI'),
    ts.id
  FROM timetable_sessions ts
  WHERE ts.teacher_id = p_teacher_id
    AND ts.day_of_week = p_day
    AND ts.status != 'draft'
    AND (p_exclude_id IS NULL OR ts.id != p_exclude_id)
    AND (
      (p_start < ts.end_time AND p_end > ts.start_time)
    );

  -- Check class overlap
  RETURN QUERY
  SELECT 
    'class_conflict'::TEXT,
    'Class already has ' || ts.subject || ' scheduled at ' || 
    to_char(ts.start_time, 'HH24:MI') || ' - ' || to_char(ts.end_time, 'HH24:MI'),
    ts.id
  FROM timetable_sessions ts
  WHERE ts.class_id = p_class_id
    AND ts.day_of_week = p_day
    AND ts.status != 'draft'
    AND (p_exclude_id IS NULL OR ts.id != p_exclude_id)
    AND (
      (p_start < ts.end_time AND p_end > ts.start_time)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 6: PUBLISH/LOCK FUNCTIONS
-- =====================================================

-- Publish timetable for a class
CREATE OR REPLACE FUNCTION publish_class_timetable(p_class_id UUID)
RETURNS JSONB AS $$
DECLARE
  conflict_count INTEGER;
  result JSONB;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can publish timetables';
  END IF;

  -- Check for conflicts in draft sessions
  SELECT COUNT(*) INTO conflict_count
  FROM timetable_sessions ts
  CROSS JOIN LATERAL check_timetable_conflicts(
    ts.class_id, ts.teacher_id, ts.day_of_week, 
    ts.start_time, ts.end_time, ts.id
  ) conflicts
  WHERE ts.class_id = p_class_id AND ts.status = 'draft';
  
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Cannot publish: % conflicts detected. Please resolve conflicts first.', conflict_count;
  END IF;
  
  -- Publish all draft sessions
  UPDATE timetable_sessions
  SET status = 'published', updated_at = NOW()
  WHERE class_id = p_class_id AND status = 'draft';
  
  -- Update or create metadata
  INSERT INTO timetable_metadata (class_id, status, published_at, published_by)
  VALUES (p_class_id, 'published', NOW(), auth.uid())
  ON CONFLICT (class_id) DO UPDATE
  SET 
    status = 'published',
    published_at = NOW(),
    published_by = auth.uid(),
    updated_at = NOW();
  
  result := jsonb_build_object(
    'success', true,
    'message', 'Timetable published successfully',
    'published_at', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Lock timetable for a class
CREATE OR REPLACE FUNCTION lock_class_timetable(p_class_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can lock timetables';
  END IF;

  -- Lock all published sessions
  UPDATE timetable_sessions
  SET status = 'locked', updated_at = NOW()
  WHERE class_id = p_class_id AND status = 'published';
  
  -- Update metadata
  UPDATE timetable_metadata
  SET 
    status = 'locked',
    locked_at = NOW(),
    locked_by = auth.uid(),
    updated_at = NOW()
  WHERE class_id = p_class_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Timetable locked successfully',
    'locked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unlock timetable for a class
CREATE OR REPLACE FUNCTION unlock_class_timetable(p_class_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can unlock timetables';
  END IF;

  -- Unlock all locked sessions
  UPDATE timetable_sessions
  SET status = 'published', updated_at = NOW()
  WHERE class_id = p_class_id AND status = 'locked';
  
  -- Update metadata
  UPDATE timetable_metadata
  SET 
    status = 'published',
    locked_at = NULL,
    locked_by = NULL,
    updated_at = NOW()
  WHERE class_id = p_class_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Timetable unlocked successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unpublish timetable (revert to draft)
CREATE OR REPLACE FUNCTION unpublish_class_timetable(p_class_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can unpublish timetables';
  END IF;

  -- Cannot unpublish locked timetables
  IF EXISTS (SELECT 1 FROM timetable_metadata WHERE class_id = p_class_id AND status = 'locked') THEN
    RAISE EXCEPTION 'Cannot unpublish locked timetable. Unlock it first.';
  END IF;

  -- Unpublish all published sessions
  UPDATE timetable_sessions
  SET status = 'draft', updated_at = NOW()
  WHERE class_id = p_class_id AND status = 'published';
  
  -- Update metadata
  UPDATE timetable_metadata
  SET 
    status = 'draft',
    published_at = NULL,
    published_by = NULL,
    updated_at = NOW()
  WHERE class_id = p_class_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Timetable unpublished successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 7: GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION check_timetable_conflicts(UUID, UUID, TEXT, TIME, TIME, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_class_timetable(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_class_timetable(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_class_timetable(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unpublish_class_timetable(UUID) TO authenticated;

-- =====================================================
-- PART 8: TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timetable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timetable_sessions_updated_at ON timetable_sessions;
CREATE TRIGGER timetable_sessions_updated_at
  BEFORE UPDATE ON timetable_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_timetable_updated_at();

DROP TRIGGER IF EXISTS timetable_metadata_updated_at ON timetable_metadata;
CREATE TRIGGER timetable_metadata_updated_at
  BEFORE UPDATE ON timetable_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_timetable_updated_at();

-- =====================================================
-- PART 9: VERIFICATION QUERIES
-- =====================================================

-- Check tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('timetable_sessions', 'timetable_metadata')
ORDER BY table_name;

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('timetable_sessions', 'timetable_metadata')
ORDER BY tablename, indexname;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('timetable_sessions', 'timetable_metadata');

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('timetable_sessions', 'timetable_metadata')
ORDER BY tablename, policyname;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 
  '✅ Timetable database schema created successfully!' as message,
  'Tables: timetable_sessions, timetable_metadata' as tables,
  'RLS policies enforced for admin-only writes' as security,
  'Conflict detection functions ready' as features,
  'Publish/Lock workflows implemented' as workflows;
