'use client';

import { Edit2, Trash2, Clock, User, MapPin, Calendar } from 'lucide-react';

interface WeeklyTimetableGridProps {
  sessions: any[];
  onEditSession: (session: any) => void;
  onDeleteSession: (sessionId: string) => void;
  isLocked: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export default function WeeklyTimetableGrid({
  sessions,
  onEditSession,
  onDeleteSession,
  isLocked,
}: WeeklyTimetableGridProps) {
  const getSessionsForDayAndTime = (day: string, time: string) => {
    return sessions.filter(session => {
      const sessionStart = session.start_time.substring(0, 5);
      return session.day_of_week === day && sessionStart === time;
    });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500/20 border-gray-500/30';
      case 'published':
        return 'bg-green-500/20 border-green-500/30';
      case 'locked':
        return 'bg-red-500/20 border-red-500/30';
      default:
        return 'bg-white/5 border-white/10';
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">Weekly Timetable</h3>

      {/* Desktop View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="bg-white/10 border border-white/20 p-3 text-left text-sm font-semibold text-gray-300 sticky left-0 z-10">
                Time
              </th>
              {DAYS.map(day => (
                <th key={day} className="bg-white/10 border border-white/20 p-3 text-center text-sm font-semibold text-gray-300">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map(time => (
              <tr key={time}>
                <td className="bg-white/5 border border-white/20 p-3 text-sm font-medium text-gray-400 sticky left-0 z-10">
                  {time}
                </td>
                {DAYS.map(day => {
                  const daySessions = getSessionsForDayAndTime(day, time);
                  return (
                    <td key={`${day}-${time}`} className="border border-white/20 p-2 align-top min-w-[150px]">
                      {daySessions.map(session => (
                        <div
                          key={session.id}
                          className={`${getStatusColor(session.status)} border rounded-lg p-2 mb-2 last:mb-0 group hover:shadow-lg transition-all`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white text-sm truncate">
                                {session.subject}
                              </div>
                              <div className="text-xs text-gray-300 mt-1 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="truncate">{session.teacher_name}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(session.start_time)} - {formatTime(session.end_time)}
                              </div>
                              {session.room && (
                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {session.room}
                                </div>
                              )}
                            </div>
                            {!isLocked && (
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onEditSession(session)}
                                  className="p-1 hover:bg-white/20 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                                </button>
                                <button
                                  onClick={() => onDeleteSession(session.id)}
                                  className="p-1 hover:bg-white/20 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet View */}
      <div className="lg:hidden space-y-4">
        {DAYS.map(day => {
          const daySessions = sessions.filter(s => s.day_of_week === day);
          if (daySessions.length === 0) return null;

          return (
            <div key={day} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-semibold text-white mb-3">{day}</h4>
              <div className="space-y-2">
                {daySessions
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map(session => (
                    <div
                      key={session.id}
                      className={`${getStatusColor(session.status)} border rounded-lg p-3`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-white">{session.subject}</div>
                          <div className="text-sm text-gray-300 mt-1 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {session.teacher_name}
                          </div>
                          <div className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </div>
                          {session.room && (
                            <div className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {session.room}
                            </div>
                          )}
                        </div>
                        {!isLocked && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => onEditSession(session)}
                              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => onDeleteSession(session.id)}
                              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
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
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No sessions scheduled yet. Click "Add Session" to get started.</p>
        </div>
      )}
    </div>
  );
}
