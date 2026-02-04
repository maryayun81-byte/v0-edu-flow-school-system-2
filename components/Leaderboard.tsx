'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Trophy,
  Medal,
  Crown,
  Star,
  Flame,
  Target,
  TrendingUp,
  Users,
  Loader,
  Sparkles,
  Award,
  Zap
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface LeaderboardEntry {
  id: string;
  student_name: string;
  total_points: number;
  quizzes_completed: number;
  average_score: number;
  streak_days: number;
  last_activity: string;
}

interface LeaderboardProps {
  currentStudentName?: string;
  compact?: boolean;
}

export default function Leaderboard({ currentStudentName, compact = false }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    fetchLeaderboard();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('leaderboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [timeFilter]);

  async function fetchLeaderboard() {
    try {
      let query = supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(compact ? 5 : 50);

      const { data } = await query;
      if (data) {
        setEntries(data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }

  function getRankIcon(rank: number) {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-gray-400 font-bold">#{rank}</span>;
    }
  }

  function getRankStyle(rank: number): string {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-orange-500/20 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30';
      default:
        return 'bg-white/5 border-white/10 hover:border-white/20';
    }
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-indigo-500 to-blue-600'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  const currentUserRank = currentStudentName 
    ? entries.findIndex(e => e.student_name.toLowerCase() === currentStudentName.toLowerCase()) + 1
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white">Leaderboard</h3>
          </div>
          <span className="text-xs text-gray-400">Top 5</span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-6">
            <Star className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No rankings yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 5).map((entry, idx) => {
              const rank = idx + 1;
              const isCurrentUser = currentStudentName?.toLowerCase() === entry.student_name.toLowerCase();

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentUser ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-white/5'
                  }`}
                >
                  <div className="w-8 flex items-center justify-center">
                    {getRankIcon(rank)}
                  </div>
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(entry.student_name)} flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">{getInitials(entry.student_name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isCurrentUser ? 'text-violet-300' : 'text-white'}`}>
                      {entry.student_name}
                      {isCurrentUser && <span className="text-xs text-violet-400 ml-1">(You)</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-400">{entry.total_points.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentUserRank && currentUserRank > 5 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
              <div className="w-8 flex items-center justify-center">
                <span className="text-violet-400 font-bold text-sm">#{currentUserRank}</span>
              </div>
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(currentStudentName!)} flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">{getInitials(currentStudentName!)}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-violet-300 text-sm">
                  {currentStudentName} <span className="text-xs text-violet-400">(You)</span>
                </p>
              </div>
              <p className="font-bold text-amber-400 text-sm">
                {entries.find(e => e.student_name.toLowerCase() === currentStudentName?.toLowerCase())?.total_points.toLocaleString() || 0}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full leaderboard view
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
              <p className="text-sm text-gray-400">Top performers in quizzes</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
            {(['all', 'week', 'month'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  timeFilter === filter
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {filter === 'all' ? 'All Time' : `This ${filter}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {entries.length >= 3 && (
        <div className="p-6 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex flex-wrap items-end justify-center gap-4 md:gap-8">
            {/* Second Place */}
            <div className="flex flex-col items-center order-2 md:order-1">
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${getAvatarColor(entries[1].student_name)} flex items-center justify-center mb-2 ring-4 ring-gray-400/50`}>
                <span className="text-white font-bold text-lg">{getInitials(entries[1].student_name)}</span>
              </div>
              <Medal className="w-5 h-5 md:w-6 md:h-6 text-gray-300 -mt-1 mb-1" />
              <p className="text-white font-semibold text-xs md:text-sm text-center max-w-[80px] md:max-w-[100px] truncate">{entries[1].student_name}</p>
              <p className="text-amber-400 font-bold text-sm md:text-base">{entries[1].total_points.toLocaleString()}</p>
              <div className="w-20 md:w-24 h-16 md:h-20 bg-gradient-to-t from-gray-500/30 to-gray-400/20 rounded-t-lg mt-2" />
            </div>

            {/* First Place */}
            <div className="flex flex-col items-center order-1 md:order-2 -mb-2 md:-mb-4 w-full md:w-auto">
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${getAvatarColor(entries[0].student_name)} flex items-center justify-center mb-2 ring-4 ring-yellow-400/50 shadow-lg shadow-yellow-500/25`}>
                <span className="text-white font-bold text-lg md:text-xl">{getInitials(entries[0].student_name)}</span>
              </div>
              <Crown className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 -mt-1 mb-1" />
              <p className="text-white font-bold text-center text-sm md:text-base max-w-[100px] md:max-w-[120px] truncate">{entries[0].student_name}</p>
              <p className="text-amber-400 font-bold text-base md:text-lg">{entries[0].total_points.toLocaleString()}</p>
              <div className="w-24 md:w-28 h-24 md:h-28 bg-gradient-to-t from-yellow-500/30 to-amber-400/20 rounded-t-lg mt-2" />
            </div>

            {/* Third Place */}
            <div className="flex flex-col items-center order-3">
              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${getAvatarColor(entries[2].student_name)} flex items-center justify-center mb-2 ring-4 ring-amber-600/50`}>
                <span className="text-white font-bold">{getInitials(entries[2].student_name)}</span>
              </div>
              <Medal className="w-4 h-4 md:w-5 md:h-5 text-amber-600 -mt-1 mb-1" />
              <p className="text-white font-medium text-xs md:text-sm text-center max-w-[70px] md:max-w-[90px] truncate">{entries[2].student_name}</p>
              <p className="text-amber-400 font-bold text-xs md:text-sm">{entries[2].total_points.toLocaleString()}</p>
              <div className="w-16 md:w-20 h-10 md:h-14 bg-gradient-to-t from-amber-700/30 to-amber-600/20 rounded-t-lg mt-2" />
            </div>
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div className="p-4 md:p-6">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Rankings Yet</h3>
            <p className="text-gray-400">Complete quizzes to appear on the leaderboard!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => {
              const rank = idx + 1;
              const isCurrentUser = currentStudentName?.toLowerCase() === entry.student_name.toLowerCase();

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border transition-all ${
                    isCurrentUser 
                      ? 'bg-violet-500/20 border-violet-500/30 ring-2 ring-violet-500/20' 
                      : getRankStyle(rank)
                  }`}
                >
                  <div className="w-8 md:w-12 flex items-center justify-center shrink-0">
                    {getRankIcon(rank)}
                  </div>

                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br ${getAvatarColor(entry.student_name)} flex items-center justify-center shrink-0`}>
                    <span className="text-white font-bold">{getInitials(entry.student_name)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold truncate ${isCurrentUser ? 'text-violet-300' : 'text-white'}`}>
                        {entry.student_name}
                      </p>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.5 bg-violet-500/30 text-violet-300 text-[10px] md:text-xs rounded-full font-medium shrink-0">You</span>
                      )}
                      {rank <= 3 && (
                        <Award className={`w-4 h-4 shrink-0 ${
                          rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : 'text-amber-600'
                        }`} />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {entry.quizzes_completed} <span className="hidden sm:inline">quizzes</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {entry.average_score}% <span className="hidden sm:inline">avg</span>
                      </span>
                      {entry.streak_days > 0 && (
                        <span className="flex items-center gap-1 text-orange-400">
                          <Flame className="w-3 h-3" />
                          {entry.streak_days} <span className="hidden sm:inline">day streak</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg md:text-2xl font-bold text-amber-400">{entry.total_points.toLocaleString()}</p>
                    <p className="text-[10px] md:text-xs text-gray-500">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current user stats if not in top list */}
      {currentUserRank && currentUserRank > entries.length && (
        <div className="p-6 border-t border-white/10">
          <p className="text-gray-400 text-sm mb-3">Your Position</p>
          <div className="flex items-center gap-4 p-4 bg-violet-500/10 rounded-xl border border-violet-500/20">
            <div className="w-12 flex items-center justify-center">
              <span className="text-violet-400 font-bold">#{currentUserRank}</span>
            </div>
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(currentStudentName!)} flex items-center justify-center`}>
              <span className="text-white font-bold">{getInitials(currentStudentName!)}</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-violet-300">{currentStudentName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
