import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface TimetableSession {
  id: string;
  class_id: string;
  subject: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room?: string;
  status: 'draft' | 'published' | 'locked';
  week_number?: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  teacher_name?: string;
  class_name?: string;
}

export interface TimetableMetadata {
  id: string;
  class_id: string;
  academic_year: string;
  term?: string;
  status: 'draft' | 'published' | 'locked';
  published_at?: string;
  published_by?: string;
  locked_at?: string;
  locked_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UseTimetableOptions {
  classId?: string;
  teacherId?: string;
  studentId?: string;
  status?: 'draft' | 'published' | 'locked' | 'all';
  dayOfWeek?: string;
  enableRealtime?: boolean;
}

export function useTimetable(options: UseTimetableOptions = {}) {
  const { classId, teacherId, studentId, status = 'all', dayOfWeek, enableRealtime = true } = options;
  
  const [sessions, setSessions] = useState<TimetableSession[]>([]);
  const [metadata, setMetadata] = useState<TimetableMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch timetable sessions
      let query = supabase
        .from('timetable_sessions')
        .select('*')
        .order('day_of_week')
        .order('start_time');

      // Apply filters
      if (classId) query = query.eq('class_id', classId);
      if (teacherId) query = query.eq('teacher_id', teacherId);
      if (status !== 'all') query = query.eq('status', status);
      if (dayOfWeek) query = query.eq('day_of_week', dayOfWeek);

      const { data: sessionsData, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        return;
      }

      // Get unique teacher IDs and class IDs
      const teacherIds = [...new Set(sessionsData.map(s => s.teacher_id))];
      const classIds = [...new Set(sessionsData.map(s => s.class_id))];

      // Fetch teacher names from profiles
      const { data: teachersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);

      // Fetch class names
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds);

      // Create lookup maps
      const teacherMap = new Map(teachersData?.map(t => [t.id, t.full_name]) || []);
      const classMap = new Map(classesData?.map(c => [c.id, c.name]) || []);

      // Transform data to include teacher and class names
      const transformedData = sessionsData.map(session => ({
        ...session,
        teacher_name: teacherMap.get(session.teacher_id) || 'Unknown Teacher',
        class_name: classMap.get(session.class_id) || 'Unknown Class',
      }));

      setSessions(transformedData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching timetable sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [classId, teacherId, status, dayOfWeek]);

  const fetchMetadata = useCallback(async () => {
    if (!classId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('timetable_metadata')
        .select('*')
        .eq('class_id', classId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      setMetadata(data);
    } catch (err: any) {
      console.error('Error fetching timetable metadata:', err);
    }
  }, [classId]);

  useEffect(() => {
    fetchSessions();
    if (classId) fetchMetadata();
  }, [fetchSessions, fetchMetadata, classId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('timetable-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timetable_sessions',
          filter: classId ? `class_id=eq.${classId}` : undefined,
        },
        () => {
          fetchSessions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timetable_metadata',
          filter: classId ? `class_id=eq.${classId}` : undefined,
        },
        () => {
          fetchMetadata();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [enableRealtime, classId, fetchSessions, fetchMetadata]);

  const createSession = async (sessionData: Partial<TimetableSession>) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('timetable_sessions')
        .insert({
          ...sessionData,
          created_by: user.user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchSessions();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateSession = async (id: string, updates: Partial<TimetableSession>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('timetable_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      await fetchSessions();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('timetable_sessions')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      await fetchSessions();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const publishTimetable = async (classId: string) => {
    try {
      const { data, error } = await supabase.rpc('publish_class_timetable', {
        p_class_id: classId,
      });

      if (error) throw error;
      await fetchSessions();
      await fetchMetadata();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const lockTimetable = async (classId: string) => {
    try {
      const { data, error } = await supabase.rpc('lock_class_timetable', {
        p_class_id: classId,
      });

      if (error) throw error;
      await fetchSessions();
      await fetchMetadata();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const unlockTimetable = async (classId: string) => {
    try {
      const { data, error } = await supabase.rpc('unlock_class_timetable', {
        p_class_id: classId,
      });

      if (error) throw error;
      await fetchSessions();
      await fetchMetadata();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const unpublishTimetable = async (classId: string) => {
    try {
      const { data, error } = await supabase.rpc('unpublish_class_timetable', {
        p_class_id: classId,
      });

      if (error) throw error;
      await fetchSessions();
      await fetchMetadata();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    sessions,
    metadata,
    loading,
    error,
    refetch: fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    publishTimetable,
    lockTimetable,
    unlockTimetable,
    unpublishTimetable,
  };
}
