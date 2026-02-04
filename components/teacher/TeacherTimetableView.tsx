'use client';

import { useState } from 'react';
import { Calendar, Clock, MapPin, BookOpen, LayoutGrid, List } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import { createClient } from '@supabase/supabase-js';
import { useEffect } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TeacherTimetableView() {
  const [teacherId, setTeacherId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');

  const { sessions, loading } = useTimetable({
    teacherId,
    status: 'published',
    enableRealtime: true,
  });

  useEffect(() => {
    async function getTeacherId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setTeacherId(user.id);
    }
    getTeacherId();
  }, []);

  const getSessionsForDay = (day: string) => {
    return sessions
      .filter(s => s.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const formatTime = (time: string) => time.substring(0, 5);

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
            My Teaching Schedule
          </h2>
          <p className="text-gray-400 mt-1">View your assigned classes</p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'daily'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            Daily
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'weekly'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Weekly
          </button>
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
                    ? 'bg-indigo-600 text-white'
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
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-white text-lg">{session.subject}</div>
                      <div className="text-sm text-gray-300 mt-1">{session.class_name}</div>
                      <div className="flex flex-wrap gap-4 mt-3">
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
                        className="bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-2 text-xs"
                      >
                        <div className="font-semibold text-white truncate">{session.subject}</div>
                        <div className="text-gray-300 mt-1 truncate">{session.class_name}</div>
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
                        className="bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-3"
                      >
                        <div className="font-semibold text-white">{session.subject}</div>
                        <div className="text-sm text-gray-300 mt-1">{session.class_name}</div>
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

          {sessions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No classes assigned yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
