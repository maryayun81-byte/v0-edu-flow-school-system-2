'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, AlertCircle, Clock, User, BookOpen, MapPin } from 'lucide-react';
import { useConflictDetection } from '@/hooks/useConflictDetection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SessionEditorProps {
  session?: any;
  classId: string;
  onSave: (data: any) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SessionEditor({ session, classId, onSave, onClose }: SessionEditorProps) {
  const [formData, setFormData] = useState({
    subject: session?.subject || '',
    teacher_id: session?.teacher_id || '',
    day_of_week: session?.day_of_week || 'Monday',
    start_time: session?.start_time || '08:00',
    end_time: session?.end_time || '09:00',
    room: session?.room || '',
    notes: session?.notes || '',
  });

  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { conflicts, checking, checkConflicts, hasConflicts } = useConflictDetection();

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    // Check conflicts when relevant fields change
    if (formData.teacher_id && formData.day_of_week && formData.start_time && formData.end_time) {
      checkConflicts({
        classId,
        teacherId: formData.teacher_id,
        dayOfWeek: formData.day_of_week,
        startTime: formData.start_time,
        endTime: formData.end_time,
        excludeId: session?.id,
      });
    }
  }, [formData.teacher_id, formData.day_of_week, formData.start_time, formData.end_time]);

  async function fetchTeachers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'teacher')
        .order('full_name');

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasConflicts) {
      alert('Please resolve conflicts before saving');
      return;
    }

    setLoading(true);
    await onSave(formData);
    setLoading(false);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {session ? 'Edit Session' : 'Create New Session'}
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Conflicts Alert */}
        {hasConflicts && (
          <div className="mx-6 mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-red-300 font-semibold mb-2">Scheduling Conflicts Detected</h4>
                <ul className="space-y-1 text-sm text-red-200">
                  {conflicts.map((conflict, idx) => (
                    <li key={idx}>• {conflict.conflict_message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Subject */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <BookOpen className="w-4 h-4" />
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Mathematics, English, Science"
            />
          </div>

          {/* Teacher */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4" />
              Teacher
            </label>
            <select
              value={formData.teacher_id}
              onChange={(e) => handleChange('teacher_id', e.target.value)}
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" className="bg-gray-900">Select a teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id} className="bg-gray-900">
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4" />
              Day of Week
            </label>
            <select
              value={formData.day_of_week}
              onChange={(e) => handleChange('day_of_week', e.target.value)}
              required
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day} value={day} className="bg-gray-900">
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => handleChange('start_time', e.target.value)}
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => handleChange('end_time', e.target.value)}
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <MapPin className="w-4 h-4" />
              Room (Optional)
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => handleChange('room', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Room 101, Lab A"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Additional information..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || hasConflicts || checking}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : checking ? 'Checking...' : 'Save Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
