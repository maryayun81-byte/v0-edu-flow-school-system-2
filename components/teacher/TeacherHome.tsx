"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Calendar, CheckCircle, Clock, AlertTriangle, ChevronRight, 
  FileText, Plus, Bell, MessageSquare, Zap, Target, TrendingUp, 
  Users, BookOpen, ExternalLink, ArrowRight 
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
interface TeacherHomeProps {
  userId: string;
  userName: string;
  onNavigate: (tab: string) => void;
}

interface TimetableSession {
  id: string;
  subject: string;
  class_name: string;
  start_time: string;
  end_time: string;
  room?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
}

interface ActionItem {
  id: string;
  type: 'urgent' | 'warning' | 'info';
  title: string;
  subtitle: string;
  cta_text: string;
  cta_action: () => void;
}

interface RecentActivity {
  id: string;
  text: string;
  time_ago: string;
  icon: any;
  color: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherHome({ userId, userName, onNavigate }: TeacherHomeProps) {
  const [loading, setLoading] = useState(true);
  const [todayClasses, setTodayClasses] = useState<TimetableSession[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [stats, setStats] = useState({
    classesToday: 0,
    assignmentsPending: 0,
    studentsAtRisk: 0,
    unreadMessages: 0
  });

  const today = new Date();
  const dayName = DAYS[today.getDay()];
  const dateString = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (userId) {
      fetchDashboardData();
    }
  }, [userId]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      // 1. Fetch Today's Classes (Keeping existing logic)
      const { data: sessions } = await supabase
        .from('timetable_sessions')
        .select(`
          id, subject, start_time, end_time, room,
          classes!inner(name)
        `)
        .eq('teacher_id', userId)
        .eq('day_of_week', dayName)
        .order('start_time', { ascending: true });

      const processedClasses: TimetableSession[] = (sessions || []).map((s: any) => {
        const now = new Date();
        const [startH, startM] = s.start_time.split(':').map(Number);
        const [endH, endM] = s.end_time.split(':').map(Number);
        
        const startTime = new Date(); startTime.setHours(startH, startM, 0);
        const endTime = new Date(); endTime.setHours(endH, endM, 0);

        let status: 'upcoming' | 'ongoing' | 'completed' = 'upcoming';
        if (now > endTime) status = 'completed';
        else if (now >= startTime && now <= endTime) status = 'ongoing';

        return {
          id: s.id,
          subject: s.subject,
          class_name: s.classes.name,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
          status
        };
      });
      setTodayClasses(processedClasses);

      // 2. Fetch Assignments & Submissions (Real Data)
      const { data: recentAssignments } = await supabase
        .from('assignments')
        .select(`
          id, title, due_date, status, total_marks,
          classes(name),
          student_submissions(id, status)
        `)
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // 3. Fetch Active/Closed Exams (Real Data)
      const { data: exams } = await supabase
        .from('exams')
        .select('*')
        .in('status', ['Active', 'Closed'])
        .order('end_date', { ascending: true });

      // 4. Fetch Messages (Real Data - simplified)
      // Get conversations the user is part of
      const { data: conversationsData } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id, last_read_at,
          conversations (
            last_message_at:updated_at
          )
        `)
        .eq('user_id', userId)
        .order('last_read_at', { ascending: false }) // Approximate recency
        .limit(5);

      // 5. Build Actions & Insights
      const newActions: ActionItem[] = [];
      let pendingGradingCount = 0;
      let lowSubmissionCount = 0;

      // Analyze Assignments for Actions
      if (recentAssignments) {
        recentAssignments.forEach((assignment: any) => {
          const submissionCount = assignment.student_submissions?.length || 0;
          const gradedCount = assignment.student_submissions?.filter((s: any) => s.status === 'MARKED').length || 0;
          const needsGrading = submissionCount - gradedCount;
          
          if (needsGrading > 0) {
            pendingGradingCount += needsGrading;
          }

          // Insight: Low submissions (arbitrary threshold < 5 for now)
          if (submissionCount < 5 && new Date(assignment.due_date) < new Date()) {
             lowSubmissionCount++;
          }
        });

        if (pendingGradingCount > 0) {
            newActions.push({
                id: 'grading-due',
                type: 'urgent',
                title: `${pendingGradingCount} Submissions to Grade`,
                subtitle: 'Students are waiting for feedback',
                cta_text: 'Grade Now',
                cta_action: () => onNavigate('assignments')
            });
        }
      }

      // Analyze Exams for Actions
      if (exams && exams.length > 0) {
        const closedExams = exams.filter((e: any) => e.status === 'Closed');
        if (closedExams.length > 0) {
             newActions.push({
                id: 'exam-marks',
                type: 'urgent',
                title: 'Enter Exam Marks',
                subtitle: `${closedExams.length} closed exams pending marks`,
                cta_text: 'Enter Marks',
                cta_action: () => onNavigate('marks')
             });
        }
      }

      setActions(newActions);

      // 6. Stats
      setStats({
        classesToday: sessions?.length || 0,
        assignmentsPending: pendingGradingCount,
        studentsAtRisk: lowSubmissionCount, // Reusing this metric
        unreadMessages: 0 // Hard to calc without full query, leaving 0 or removing badge
      });

      // 7. Recent Activity (from Notifications table is best source of truth)
      const { data: notifications } = await supabase
        .from('notifications')
        .or(`target_user_id.eq.${userId},target_role.eq.teacher`)
        .order('created_at', { ascending: false })
        .limit(5);

      const activity = (notifications || []).map((n: any) => ({
        id: n.id,
        text: n.message,
        time_ago: getTimeAgo(new Date(n.created_at)),
        icon: Bell, 
        color: 'text-blue-400'
      }));
      setRecentActivity(activity);

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function getTimeAgo(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-40 bg-white/5 rounded-2xl" />
        <div className="h-64 bg-white/5 rounded-2xl" />
        <div className="h-40 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-[fadeIn_0.3s_ease-out]">
      
      {/* 1. Today's Snapshot */}
      <section className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-indigo-300 font-medium text-sm uppercase tracking-wider mb-1">{dayName}, {dateString}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Good Morning, {userName.split(' ')[0]}</h1>
            <div className="flex items-center gap-3">
               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium border border-white/5">
                 <Clock className="w-3.5 h-3.5 text-indigo-400" />
                 {stats.classesToday} Classes Today
               </span>
               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-sm font-medium border border-white/5">
                 <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                 All Systems Normal
               </span>
            </div>
          </div>
          {/* Weather or Quick Status Icon could go here */}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN (Main Feed) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 2. Today's Classes - Timeline View */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Today's Schedule
              </h2>
              <button onClick={() => onNavigate('timetable')} className="text-sm text-indigo-300 hover:text-white transition-colors">View Full</button>
            </div>
            
            {todayClasses.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                    <p className="text-gray-400">No classes scheduled for today.</p>
                </div>
            ) : (
                <div className="space-y-4">
                {todayClasses.map((session, idx) => (
                    <div 
                    key={session.id}
                    className={cn(
                        "relative flex items-center gap-4 p-4 rounded-2xl border transition-all",
                        session.status === 'ongoing' 
                            ? "bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10" 
                            : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                    >
                    {/* Time Pillar */}
                    <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-sm font-bold text-white">{session.start_time}</span>
                        <span className="text-xs text-gray-500">{session.end_time}</span>
                    </div>

                    {/* Status Indicator Line */}
                    <div className={cn(
                        "w-1 h-12 rounded-full",
                        session.status === 'ongoing' ? "bg-indigo-500 animate-pulse" :
                        session.status === 'completed' ? "bg-gray-700" :
                        "bg-emerald-500" // Upcoming
                    )} />

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className="font-bold text-white text-lg">{session.subject}</h3>
                        <p className="text-indigo-200 text-sm">{session.class_name} • {session.room || "Room 101"}</p>
                    </div>

                    {/* Action */}
                    {session.status === 'ongoing' && (
                        <button className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                            Start
                        </button>
                    )}
                    </div>
                ))}
                </div>
            )}
          </section>

          {/* 3. Action Required */}
          <section>
             <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Action Required
              </h2>
            </div>
            {actions.length === 0 ? (
                 <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4">
                     <CheckCircle className="w-8 h-8 text-emerald-500" />
                     <div>
                         <p className="text-emerald-300 font-bold">All caught up!</p>
                         <p className="text-emerald-400/60 text-sm">No urgent actions pending.</p>
                     </div>
                 </div>
            ) : (
                <div className="grid gap-3">
                    {actions.map(action => (
                        <div key={action.id} className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between group hover:border-amber-500/40 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                                    !
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{action.title}</h3>
                                    <p className="text-sm text-gray-400">{action.subtitle}</p>
                                </div>
                            </div>
                            <button 
                                onClick={action.cta_action}
                                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 group-hover:translate-x-1"
                            >
                                {action.cta_text} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </section>

          {/* 6. Recent Activity Feed */}
          <section>
            <h2 className="text-lg font-bold text-white mb-4 px-2">Recent Activity</h2>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
                {recentActivity.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No recent activity.</p>
                ) : (
                     recentActivity.map((item, i) => (
                        <div key={item.id} className="flex gap-4">
                            <div className="relative">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 z-10 relative" />
                                {i !== recentActivity.length - 1 && (
                                    <div className="absolute top-4 left-1 w-[1px] h-full bg-white/10 -ml-[0.5px]" />
                                )}
                            </div>
                            <div>
                                <p className="text-gray-300 text-sm">{item.text}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.time_ago}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN (Sidebar / Quick Actions) */}
        <div className="space-y-8">
            
            {/* 5. Quick Actions */}
            <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => onNavigate('action_add_assignment')}
                        className="flex flex-col items-center justify-center p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/25 group"
                    >
                        <Plus className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold">Add Assignment</span>
                    </button>
                     <button 
                        onClick={() => onNavigate('action_add_note')}
                        className="flex flex-col items-center justify-center p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/5 hover:border-white/20"
                    >
                        <FileText className="w-6 h-6 mb-2 text-indigo-400" />
                        <span className="text-xs font-bold">Add Note</span>
                    </button>
                    <button 
                        onClick={() => onNavigate('marks')}
                        className="flex flex-col items-center justify-center p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/5 hover:border-white/20"
                    >
                        <Target className="w-6 h-6 mb-2 text-emerald-400" />
                        <span className="text-xs font-bold">Enter Marks</span>
                    </button>
                     <button 
                        onClick={() => onNavigate('students')}
                        className="flex flex-col items-center justify-center p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/5 hover:border-white/20"
                    >
                        <Users className="w-6 h-6 mb-2 text-pink-400" />
                        <span className="text-xs font-bold">Students</span>
                    </button>
                </div>
            </section>

             {/* 7. Insights (Real Data based on assignments) */}
             <section className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-3xl p-6">
                <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Insights
                </h2>
                <div className="space-y-4">
                    {stats.studentsAtRisk > 0 ? (
                        <div className="flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                            <div>
                                <p className="text-white font-medium text-sm">Low Submission Rates</p>
                                <p className="text-xs text-gray-400 mt-0.5">{stats.studentsAtRisk} assignments have low submission counts.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                             <div>
                                <p className="text-white font-medium text-sm">On Track</p>
                                <p className="text-xs text-gray-400 mt-0.5">Student submission rates are looking good.</p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 8. Messages Summary */}
            <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
                 <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Messages</h2>
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">Recent</span>
                 </div>
                 <div className="space-y-3">
                     <p className="text-xs text-gray-500 text-center py-2">
                        Check your inbox for new messages.
                     </p>
                     <button 
                        onClick={() => onNavigate('messages')}
                        className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs font-bold rounded-xl transition-all"
                     >
                        Go to Inbox
                     </button>
                 </div>
            </section>

        </div>

      </div>

    </div>
  );
}
