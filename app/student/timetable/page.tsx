'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, BookOpen, User, LayoutGrid, List, Filter } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StudentTimetablePage() {
  const [classId, setClassId] = useState<string>('');
  const [studentSubjects, setStudentSubjects] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly');
  const [filterMode, setFilterMode] = useState<'my_subjects' | 'full_class'>('my_subjects');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [loading, setLoading] = useState(true);

  const { sessions, loading: sessionsLoading } = useTimetable({
    classId,
    status: 'published',
    enableRealtime: true,
  });

  useEffect(() => {
    async function fetchStudentData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('form_class, subjects')
          .eq('id', user.id)
          .single();

        if (profile) {
          // Get class ID from form_class name
          const { data: classData } = await supabase
            .from('classes')
            .select('id')
            .eq('name', profile.form_class)
            .single();

          if (classData) setClassId(classData.id);
          setStudentSubjects(profile.subjects || []);
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStudentData();
  }, []);

  const filteredSessions = filterMode === 'my_subjects'
    ? sessions.filter(s => studentSubjects.includes(s.subject))
    : sessions;

  const getSessionsForDay = (day: string) => {
    return filteredSessions
      .filter(s => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const isMySubject = (subject: string) => studentSubjects.includes(subject);
  const formatTime = (time: string) => time.substring(0, 5);

  if (loading || sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Calendar className="w-8 h-8 text-indigo-400" />
              My Timetable
            </h1>
            <p className="text-gray-400 mt-1">View your class schedule</p>
          </div>

          {/* View Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
              <button
                onClick={() => setFilterMode('my_subjects')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterMode === 'my_subjects'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                My Subjects
              </button>
              <button
                onClick={() => setFilterMode('full_class')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterMode === 'full_class'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Full Class
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
              <button
                onClick={() => setViewMode('daily')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  viewMode === 'daily'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                Daily
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  viewMode === 'weekly'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Weekly
              </button>
            </div>
          </div>
        </div>

        {/* Daily View */}
        {viewMode === 'daily' && (
          <div className="space-y-4">
            {/* Day Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                    selectedDay === day
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Sessions for Selected Day */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">{selectedDay}</h3>
              <div className="space-y-3">
                {getSessionsForDay(selectedDay).map(session => (
                  <div
                    key={session.id}
                    className={`border rounded-xl p-4 transition-all ${
                      isMySubject(session.subject)
                        ? 'bg-indigo-500/20 border-indigo-500/40 shadow-lg'
                        : 'bg-white/5 border-white/10 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className={`font-semibold text-lg ${
                          isMySubject(session.subject) ? 'text-white' : 'text-gray-300'
                        }`}>
                          {session.subject}
                          {isMySubject(session.subject) && (
                            <span className="ml-2 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                              My Subject
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
                          <User className="w-4 h-4" />
                          {session.teacher_name}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Clock className="w-4 h-4" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </div>
                          {session.room && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <MapPin className="w-4 h-4" />
                              {session.room}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {getSessionsForDay(selectedDay).length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No classes scheduled for {selectedDay}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Weekly View */}
        {viewMode === 'weekly' && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Weekly Schedule</h3>
            
            {/* Desktop Grid */}
            <div className="hidden md:grid md:grid-cols-7 gap-3">
              {DAYS.map(day => {
                const daySessions = getSessionsForDay(day);
                return (
                  <div key={day} className="space-y-2">
                    <div className="font-semibold text-white text-center pb-2 border-b border-white/10">
                      {day.substring(0, 3)}
                    </div>
                    <div className="space-y-2">
                      {daySessions.map(session => (
                        <div
                          key={session.id}
                          className={`border rounded-lg p-2 text-xs transition-all ${
                            isMySubject(session.subject)
                              ? 'bg-indigo-500/20 border-indigo-500/40'
                              : 'bg-white/5 border-white/10 opacity-50'
                          }`}
                        >
                          <div className={`font-semibold truncate ${
                            isMySubject(session.subject) ? 'text-white' : 'text-gray-400'
                          }`}>
                            {session.subject}
                          </div>
                          <div className="text-gray-400 mt-1 truncate text-xs">
                            {session.teacher_name}
                          </div>
                          <div className="text-gray-400 mt-1">
                            {formatTime(session.start_time)}
                          </div>
                          {session.room && (
                            <div className="text-gray-400 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {session.room}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile List */}
            <div className="md:hidden space-y-4">
              {DAYS.map(day => {
                const daySessions = getSessionsForDay(day);
                if (daySessions.length === 0) return null;

                return (
                  <div key={day} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h4 className="font-semibold text-white mb-3">{day}</h4>
                    <div className="space-y-2">
                      {daySessions.map(session => (
                        <div
                          key={session.id}
                          className={`border rounded-lg p-3 ${
                            isMySubject(session.subject)
                              ? 'bg-indigo-500/20 border-indigo-500/40'
                              : 'bg-white/5 border-white/10 opacity-60'
                          }`}
                        >
                          <div className={`font-semibold ${
                            isMySubject(session.subject) ? 'text-white' : 'text-gray-300'
                          }`}>
                            {session.subject}
                            {isMySubject(session.subject) && (
                              <span className="ml-2 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                                My Subject
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{session.teacher_name}</div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </div>
                            {session.room && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {session.room}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredSessions.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No classes scheduled</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
