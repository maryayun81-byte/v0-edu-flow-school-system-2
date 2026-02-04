'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Calendar, Plus, Lock, Unlock, Eye, EyeOff, Save, AlertTriangle } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import SessionEditor from './SessionEditor';
import WeeklyTimetableGrid from './WeeklyTimetableGrid';
import TimetablePublisher from './TimetablePublisher';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Class {
  id: string;
  name: string;
  form_level: string;
}

export default function AdminTimetableTab() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showSessionEditor, setShowSessionEditor] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const {
    sessions,
    metadata,
    loading: sessionsLoading,
    createSession,
    updateSession,
    deleteSession,
    publishTimetable,
    lockTimetable,
    unlockTimetable,
    unpublishTimetable,
    refetch,
  } = useTimetable({
    classId: selectedClassId,
    status: 'all',
    enableRealtime: true,
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('form_level')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateSession = () => {
    setEditingSession(null);
    setShowSessionEditor(true);
  };

  const handleEditSession = (session: any) => {
    setEditingSession(session);
    setShowSessionEditor(true);
  };

  const handleSaveSession = async (sessionData: any) => {
    if (editingSession) {
      await updateSession(editingSession.id, sessionData);
    } else {
      await createSession({ ...sessionData, class_id: selectedClassId });
    }
    setShowSessionEditor(false);
    setEditingSession(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      await deleteSession(sessionId);
    }
  };

  const getStatusBadge = () => {
    if (!metadata) return null;

    const statusColors = {
      draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      published: 'bg-green-500/20 text-green-300 border-green-500/30',
      locked: 'bg-red-500/20 text-red-300 border-red-500/30',
    };

    const statusIcons = {
      draft: Eye,
      published: EyeOff,
      locked: Lock,
    };

    const Icon = statusIcons[metadata.status];
    const colorClass = statusColors[metadata.status];

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass} text-sm font-medium`}>
        <Icon className="w-4 h-4" />
        {metadata.status.charAt(0).toUpperCase() + metadata.status.slice(1)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-indigo-400" />
            Timetable Management
          </h2>
          <p className="text-gray-400 mt-1">Create and manage class timetables</p>
        </div>
        
        <div className="flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={handleCreateSession}
            disabled={metadata?.status === 'locked'}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Session</span>
          </button>
        </div>
      </div>

      {/* Class Selector */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Class
        </label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full sm:w-64 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id} className="bg-gray-900">
              {cls.name} ({cls.form_level})
            </option>
          ))}
        </select>
      </div>

      {/* Timetable Grid */}
      {selectedClassId && (
        <>
          <WeeklyTimetableGrid
            sessions={sessions}
            onEditSession={handleEditSession}
            onDeleteSession={handleDeleteSession}
            isLocked={metadata?.status === 'locked'}
          />

          {/* Publisher Controls */}
          <TimetablePublisher
            classId={selectedClassId}
            metadata={metadata}
            sessions={sessions}
            onPublish={publishTimetable}
            onLock={lockTimetable}
            onUnlock={unlockTimetable}
            onUnpublish={unpublishTimetable}
          />
        </>
      )}

      {/* Session Editor Modal */}
      {showSessionEditor && (
        <SessionEditor
          session={editingSession}
          classId={selectedClassId}
          onSave={handleSaveSession}
          onClose={() => {
            setShowSessionEditor(false);
            setEditingSession(null);
          }}
        />
      )}
    </div>
  );
}
