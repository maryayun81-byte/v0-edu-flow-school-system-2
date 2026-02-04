import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ConflictResult {
  conflict_type: 'teacher_conflict' | 'class_conflict';
  conflict_message: string;
  conflicting_session_id: string;
}

export interface ConflictCheckParams {
  classId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  excludeId?: string;
}

export function useConflictDetection() {
  const [conflicts, setConflicts] = useState<ConflictResult[]>([]);
  const [checking, setChecking] = useState(false);

  const checkConflicts = useCallback(async (params: ConflictCheckParams) => {
    try {
      setChecking(true);
      setConflicts([]);

      const { data, error } = await supabase.rpc('check_timetable_conflicts', {
        p_class_id: params.classId,
        p_teacher_id: params.teacherId,
        p_day: params.dayOfWeek,
        p_start: params.startTime,
        p_end: params.endTime,
        p_exclude_id: params.excludeId || null,
      });

      if (error) throw error;

      setConflicts(data || []);
      return {
        hasConflicts: (data || []).length > 0,
        conflicts: data || [],
      };
    } catch (err: any) {
      console.error('Error checking conflicts:', err);
      return {
        hasConflicts: false,
        conflicts: [],
        error: err.message,
      };
    } finally {
      setChecking(false);
    }
  }, []);

  const clearConflicts = useCallback(() => {
    setConflicts([]);
  }, []);

  return {
    conflicts,
    checking,
    checkConflicts,
    clearConflicts,
    hasConflicts: conflicts.length > 0,
  };
}
