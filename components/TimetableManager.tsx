'use client';

import React from "react"

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, 
  X, 
  Trash2, 
  Loader, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Video,
  ExternalLink,
  Clock,
  MapPin,
  Copy,
  Check,
  Monitor,
  Building
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TimetableEntry {
  id: string;
  title: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  created_by: string;
  class_date?: string;
  is_online?: boolean;
  meeting_link?: string;
  meeting_id?: string;
  meeting_password?: string;
  location?: string;
}

interface TimetableManagerProps {
  userId: string;
  onClose: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates(date: Date): Date[] {
  const week = [];
  const first = date.getDate() - date.getDay() + 1;
  for (let i = 0; i < 7; i++) {
    const day = new Date(date);
    day.setDate(first + i);
    week.push(day);
  }
  return week;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDayName(date: Date): string {
  return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

export default function TimetableManager({ userId, onClose }: TimetableManagerProps) {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [classDate, setClassDate] = useState(formatDate(new Date()));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [subject, setSubject] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchEntries();
  }, [userId]);

  async function fetchEntries() {
    try {
      const { data } = await supabase
        .from('timetables')
        .select('*')
        .eq('created_by', userId)
        .order('class_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (data) setEntries(data);
    } catch (error) {
      console.error('Error fetching timetable:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!userId) {
      setError('User ID is missing. Please log in again.');
      setLoading(false);
      return;
    }

    const selectedDateObj = new Date(classDate);
    const dayOfWeek = getDayName(selectedDateObj);

    try {
      const { error } = await supabase.from('timetables').insert([
        {
          title,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          subject,
          created_by: userId,
          class_date: classDate,
          is_online: isOnline,
          meeting_link: isOnline ? meetingLink : null,
          meeting_id: isOnline ? meetingId : null,
          meeting_password: isOnline ? meetingPassword : null,
          location: !isOnline ? location : null,
        },
      ]);

      if (error) throw error;

      // Create notification for students
      await supabase.from('notifications').insert([
        {
          type: 'class',
          title: isOnline ? 'New Online Class' : 'New Class Scheduled',
          message: `${title} - ${subject} on ${classDate} at ${startTime}${isOnline ? ' (Online)' : ''}`,
          created_by: userId,
        },
      ]);

      setSuccessMessage('Class added successfully!');
      resetForm();
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchEntries();
    } catch (error: unknown) {
      console.error('Error creating timetable entry:', error);
      setError(error instanceof Error ? error.message : 'Failed to add class');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle('');
    setSubject('');
    setIsOnline(false);
    setMeetingLink('');
    setMeetingId('');
    setMeetingPassword('');
    setLocation('');
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this class?')) return;

    try {
      await supabase.from('timetables').delete().eq('id', id);
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate);
  }

  function navigateDay(direction: 'prev' | 'next') {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const weekDates = getWeekDates(selectedDate);
  const selectedDateStr = formatDate(selectedDate);

  const filteredEntries = viewMode === 'day'
    ? entries.filter(e => e.class_date === selectedDateStr || (!e.class_date && e.day_of_week === getDayName(selectedDate)))
    : entries.filter(e => {
        const weekStart = formatDate(weekDates[0]);
        const weekEnd = formatDate(weekDates[6]);
        return (e.class_date && e.class_date >= weekStart && e.class_date <= weekEnd) || !e.class_date;
      });

  const entriesByDay = DAYS.reduce((acc, day, idx) => {
    const dateStr = formatDate(weekDates[idx]);
    acc[day] = filteredEntries.filter(e => 
      e.class_date === dateStr || (!e.class_date && e.day_of_week === day)
    );
    return acc;
  }, {} as Record<string, TimetableEntry[]>);

  return (
    <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 mb-8 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Manage Timetable</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-2 transition-colors rounded-lg hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm font-medium">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
          <p className="text-emerald-400 text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'day' 
                ? 'bg-violet-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Day View
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'week' 
                ? 'bg-violet-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Week View
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => viewMode === 'week' ? navigateWeek('prev') : navigateDay('prev')}
            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-2 bg-white/5 rounded-lg min-w-[200px] text-center">
            <span className="text-white font-medium">
              {viewMode === 'week' 
                ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              }
            </span>
          </div>
          <button
            onClick={() => viewMode === 'week' ? navigateWeek('next') : navigateDay('next')}
            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {!showForm ? (
        <div className="space-y-4">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-3 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-violet-500/25"
          >
            <Plus className="w-5 h-5" />
            Add Class
          </button>

          {viewMode === 'week' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {DAYS.map((dayName, idx) => {
                const dayDate = weekDates[idx];
                const isToday = formatDate(dayDate) === formatDate(new Date());
                const dayEntries = entriesByDay[dayName] || [];

                return (
                  <div 
                    key={dayName} 
                    className={`rounded-xl p-4 border transition-all ${
                      isToday 
                        ? 'bg-violet-500/10 border-violet-500/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="mb-3">
                      <h3 className={`font-bold ${isToday ? 'text-violet-400' : 'text-white'}`}>
                        {dayName.slice(0, 3)}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {dayEntries.length === 0 ? (
                      <p className="text-gray-600 text-xs">No classes</p>
                    ) : (
                      <div className="space-y-2">
                        {dayEntries.map((entry) => (
                          <ClassCard 
                            key={entry.id} 
                            entry={entry} 
                            onDelete={handleDelete}
                            onCopy={copyToClipboard}
                            copiedId={copiedId}
                            compact
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No classes scheduled for this day</p>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <ClassCard 
                    key={entry.id} 
                    entry={entry} 
                    onDelete={handleDelete}
                    onCopy={copyToClipboard}
                    copiedId={copiedId}
                  />
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Class Title</label>
              <input
                type="text"
                placeholder="e.g., Mathematics Lecture"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Subject</label>
              <input
                type="text"
                placeholder="e.g., Calculus"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Date</label>
              <input
                type="date"
                value={classDate}
                onChange={(e) => setClassDate(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                required
              />
            </div>
          </div>

          {/* Class Type Toggle */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <label className="block text-sm font-medium text-gray-400 mb-4">Class Type</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsOnline(false)}
                className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  !isOnline 
                    ? 'border-violet-500 bg-violet-500/10 text-white' 
                    : 'border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <Building className="w-5 h-5" />
                <span className="font-medium">In-Person</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOnline(true)}
                className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  isOnline 
                    ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                    : 'border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span className="font-medium">Online Class</span>
              </button>
            </div>
          </div>

          {isOnline ? (
            <div className="bg-emerald-500/5 rounded-xl p-5 border border-emerald-500/20 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Online Meeting Details</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Meeting Link (Zoom, Google Meet, etc.)</label>
                <input
                  type="url"
                  placeholder="https://zoom.us/j/..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Meeting ID (optional)</label>
                  <input
                    type="text"
                    placeholder="123 456 7890"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Password (optional)</label>
                  <input
                    type="text"
                    placeholder="abc123"
                    value={meetingPassword}
                    onChange={(e) => setMeetingPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Location (optional)</label>
              <input
                type="text"
                placeholder="e.g., Room 101, Building A"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
            >
              {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {loading ? 'Adding...' : 'Add Class'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-8 bg-white/10 text-white font-semibold py-3 rounded-xl hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ClassCard({ 
  entry, 
  onDelete, 
  onCopy,
  copiedId,
  compact = false 
}: { 
  entry: TimetableEntry; 
  onDelete: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  compact?: boolean;
}) {
  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {entry.is_online && (
              <span className="shrink-0 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
            <p className={`font-semibold text-white truncate ${compact ? 'text-sm' : ''}`}>
              {entry.title}
            </p>
          </div>
          {entry.subject && (
            <p className={`text-gray-400 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {entry.subject}
            </p>
          )}
          <div className={`flex items-center gap-1 text-violet-400 mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            <Clock className="w-3 h-3" />
            <span>{entry.start_time} - {entry.end_time}</span>
          </div>
        </div>
        {!compact && (
          <button
            onClick={() => onDelete(entry.id)}
            className="text-gray-500 hover:text-red-400 p-1 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {!compact && (
        <>
          {entry.is_online && entry.meeting_link && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                <Video className="w-4 h-4" />
                <span className="font-medium">Online Class</span>
              </div>
              <a
                href={entry.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Join Meeting
              </a>
              {(entry.meeting_id || entry.meeting_password) && (
                <div className="mt-2 space-y-1">
                  {entry.meeting_id && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">ID: {entry.meeting_id}</span>
                      <button
                        onClick={() => onCopy(entry.meeting_id!, `id-${entry.id}`)}
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedId === `id-${entry.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                  {entry.meeting_password && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Pass: {entry.meeting_password}</span>
                      <button
                        onClick={() => onCopy(entry.meeting_password!, `pw-${entry.id}`)}
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedId === `pw-${entry.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!entry.is_online && entry.location && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{entry.location}</span>
              </div>
            </div>
          )}
        </>
      )}

      {compact && entry.is_online && (
        <div className="mt-2 flex items-center gap-1 text-emerald-400 text-xs">
          <Video className="w-3 h-3" />
          <span>Online</span>
        </div>
      )}
    </div>
  );
}
