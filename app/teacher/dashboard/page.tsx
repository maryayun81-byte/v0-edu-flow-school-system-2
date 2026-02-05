'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  LogOut,
  Plus,
  Trash2,
  FileText,
  Calendar,
  Loader,
  Clock,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Circle,
  ExternalLink,
  TrendingUp,
  Archive,
  Eye,
  Download,
  Brain,
  Trophy,
  User,
  Settings,
  ChevronDown,
  X,
  Users,
  CalendarDays,
  MessageSquare,
  Home,
} from 'lucide-react';
import { FloatingActionMenu } from '@/components/FloatingActionMenu';
import AssignmentWizard from '@/components/AssignmentWizard';
import { TeacherDashboardSkeleton } from '@/components/TeacherDashboardSkeleton';
import { PwaInstallButton } from '@/components/PwaInstallButton';
import { DashboardTabNavigation } from '@/components/DashboardTabNavigation';
import NotesManager from '@/components/NotesManager';
import TimetableManager from '@/components/TimetableManager';
import QuizBuilder from '@/components/QuizBuilder';
import MyStudents from '@/components/MyStudents';
import TeacherProfile from '@/components/TeacherProfile';
import MessagingCenter from '@/components/MessagingCenter';
import EventManager from '@/components/EventManager';
import TeacherMarkEntry from '@/components/teacher/TeacherMarkEntry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Note {
  id: string;
  title: string;
  description: string;
  file_url: string;
  is_archived: boolean;
  created_at: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  github_repo_link?: string;
  is_completed: boolean;
  is_archived: boolean;
  completed_at?: string;
  created_at: string;
}

interface TimetableEntry {
  id: string;
  title: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  created_at: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'notes' | 'assignments' | 'timetable' | 'quizzes' | 'profile' | 'notifications' | 'students' | 'events' | 'messages' | 'marks'>('notes');
  const [showQuizBuilder, setShowQuizBuilder] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null);
  const [showMarkEntry, setShowMarkEntry] = useState(false);
  const [allNotifications, setAllNotifications] = useState<{id: string; type: string; title: string; message: string; created_at: string; is_read: boolean}[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);

  useEffect(() => {
    // Auth is handled by layout.tsx - just get user session
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (user) {
      fetchContent();
      fetchUserProfile();
      fetchNotifications();
      setupRealtimeSubscriptions();
      // Set loading to false after initial data fetch
      setLoading(false);
    }
  }, [user]);

  async function fetchNotifications() {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        setAllNotifications(data);
        setUnreadNotifCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }

  async function fetchUserProfile() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();
      if (data) setUserProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }

  function setupRealtimeSubscriptions() {
    const notesChannel = supabase
      .channel('teacher-notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, () => {
        addNotification('New note added successfully!');
        fetchContent();
      })
      .subscribe();

    const assignmentsChannel = supabase
      .channel('teacher-assignments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignments' }, () => {
        addNotification('New assignment created!');
        fetchContent();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments' }, () => {
        fetchContent();
      })
      .subscribe();

    const timetablesChannel = supabase
      .channel('teacher-timetables')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'timetables' }, () => {
        addNotification('Class added to timetable!');
        fetchContent();
      })
      .subscribe();

    return () => {
      notesChannel.unsubscribe();
      assignmentsChannel.unsubscribe();
      timetablesChannel.unsubscribe();
    };
  }

  function addNotification(message: string) {
    setNotifications(prev => [...prev, message]);
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 4000);
  }

  async function fetchContent() {
    try {
      const [notesRes, assignmentsRes] = await Promise.all([
        supabase.from('notes').select('*').order('created_at', { ascending: false }),
        supabase.from('assignments').select('*').order('due_date', { ascending: true }),
      ]);

      if (notesRes.data) setNotes(notesRes.data);
      if (assignmentsRes.data) setAssignments(assignmentsRes.data);

      // Fetch timetable sessions for this teacher
      if (user) {
        const { data: sessionsData } = await supabase
          .from('timetable_sessions')
          .select(`
            *,
            classes!timetable_sessions_class_id_fkey(name)
          `)
          .eq('teacher_id', user.id)
          .in('status', ['published', 'locked'])
          .order('day_of_week')
          .order('start_time');

        if (sessionsData) {
          // Transform to match old timetable structure
          const transformedData = sessionsData.map((session: any) => ({
            id: session.id,
            title: session.classes?.name || 'Unknown Class',
            day_of_week: session.day_of_week,
            start_time: session.start_time,
            end_time: session.end_time,
            subject: session.subject,
            room: session.room,
            created_at: session.created_at || new Date().toISOString(),
          }));
          setTimetables(transformedData);
        }
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    }
  }

  async function toggleAssignmentComplete(id: string, currentStatus: boolean) {
    await supabase.from('assignments').update({
      is_completed: !currentStatus,
      completed_at: !currentStatus ? new Date().toISOString() : null,
    }).eq('id', id);
    addNotification(currentStatus ? 'Assignment marked as pending' : 'Assignment marked as complete!');
    fetchContent();
  }

  async function archiveNote(id: string) {
    await supabase.from('notes').update({ is_archived: true }).eq('id', id);
    addNotification('Note archived');
    fetchContent();
  }

  async function archiveAssignment(id: string) {
    await supabase.from('assignments').update({ is_archived: true }).eq('id', id);
    addNotification('Assignment archived');
    fetchContent();
  }

  function handleStartChat(studentId: string) {
    setChatUserId(studentId);
    setActiveTab('messages');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return <TeacherDashboardSkeleton />;
  }

  const activeNotes = notes.filter(n => !n.is_archived);
  const archivedNotes = notes.filter(n => n.is_archived);
  const activeAssignments = assignments.filter(a => !a.is_archived);
  const archivedAssignments = assignments.filter(a => a.is_archived);
  const completedCount = activeAssignments.filter(a => a.is_completed).length;
  const pendingCount = activeAssignments.filter(a => !a.is_completed).length;
  const upcomingDeadlines = activeAssignments.filter(a => new Date(a.due_date) > new Date() && !a.is_completed).length;

  const tabs = [
    { id: 'home', label: 'Home', icon: Home, count: null },
    { id: 'notes', label: 'Notes', icon: FileText, count: activeNotes.length },
    { id: 'assignments', label: 'Assignments', icon: Calendar, count: activeAssignments.length },
    { id: 'marks', label: 'Marks', icon: Trophy, count: null },
    { id: 'timetable', label: 'Timetable', icon: Clock, count: timetables.length },
    { id: 'quizzes', label: 'Quizzes', icon: Brain, count: null },
    { id: 'students', label: 'My Students', icon: Users, count: null },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: null },
    { id: 'events', label: 'Events', icon: CalendarDays, count: null },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadNotifCount > 0 ? unreadNotifCount : null },
    { id: 'profile', label: 'Profile', icon: User, count: null },
  ];

  const handleTabChange = (id: string) => {
    console.log('Tab change requested:', id); // Debug logging
    if (id === 'home') {
      setActiveTab('notes'); // Show notes/overview instead of redirecting
    } else {
      setActiveTab(id as any);
    }
    console.log('Active tab set to:', id === 'home' ? 'notes' : id); // Debug logging
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
      case 'notes':
        return (
          <div className="space-y-6">
            {showNoteForm && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <NotesManager userId={user?.id} onClose={() => { setShowNoteForm(false); fetchContent(); }} />
              </div>
            )}
            {!showNoteForm && (
              <>
                {activeNotes.length === 0 ? (
                  <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                    <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No active notes</p>
                    <p className="text-gray-500 mt-2">Click "Add Note" to create your first note</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activeNotes.map((note, idx) => (
                      <div
                        key={note.id}
                        className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-indigo-500/50 transition-all group animate-[fadeIn_0.3s_ease-out]"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{note.title}</h3>
                          <div className="flex gap-1">
                            {note.file_url && (
                              <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-all">
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={async () => {
                                if (confirm('Delete this note permanently?')) {
                                  await supabase.from('notes').delete().eq('id', note.id);
                                  fetchContent();
                                }
                              }}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{note.description}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{new Date(note.created_at).toLocaleDateString()}</span>
                          {note.file_url && (
                            <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'assignments':
        return (
          <div className="space-y-6">
            {showAssignmentForm && (
               <AssignmentWizard 
                  userId={user?.id} 
                  onClose={() => { setShowAssignmentForm(false); fetchContent(); }} 
                  onSuccess={() => { setShowAssignmentForm(false); fetchContent(); }}
               />
            )}
            {!showAssignmentForm && (
              <>
                {(showArchived ? archivedAssignments : activeAssignments).length === 0 ? (
                  <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No {showArchived ? 'archived' : 'active'} assignments</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(showArchived ? archivedAssignments : activeAssignments).map((assignment, idx) => {
                      const dueDate = new Date(assignment.due_date);
                      const isOverdue = dueDate < new Date() && !assignment.is_completed;
                      const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <div
                          key={assignment.id}
                          className={`bg-white/5 backdrop-blur-xl rounded-2xl p-6 border transition-all animate-[fadeIn_0.3s_ease-out] ${
                            assignment.is_completed
                              ? 'border-green-500/30 bg-green-500/5'
                              : isOverdue
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-white/10 hover:border-indigo-500/50'
                          }`}
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <button
                              onClick={() => toggleAssignmentComplete(assignment.id, assignment.is_completed)}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                assignment.is_completed
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-500 hover:border-indigo-500'
                              }`}
                            >
                              {assignment.is_completed && <CheckCircle2 className="w-5 h-5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className={`text-lg font-bold ${assignment.is_completed ? 'text-green-400 line-through' : 'text-white'}`}>
                                  {assignment.title}
                                </h3>
                                {isOverdue && (
                                  <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full">OVERDUE</span>
                                )}
                                {assignment.is_completed && (
                                  <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full">COMPLETED</span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm mb-3 line-clamp-2">{assignment.description}</p>
                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className={`font-medium ${isOverdue ? 'text-red-400' : 'text-indigo-400'}`}>
                                  Due: {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!assignment.is_completed && !isOverdue && daysUntilDue <= 7 && (
                                  <span className="text-amber-400">{daysUntilDue} days left</span>
                                )}
                                {assignment.github_repo_link && (
                                  <a
                                    href={assignment.github_repo_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    GitHub
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {!assignment.is_archived && (
                                <button onClick={() => archiveAssignment(assignment.id)} className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all">
                                  <Archive className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (confirm('Delete this assignment permanently?')) {
                                    await supabase.from('assignments').delete().eq('id', assignment.id);
                                    fetchContent();
                                  }
                                }}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'timetable':
        return (
          <div className="space-y-6">
            {showTimetableForm && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <TimetableManager userId={user?.id} onClose={() => { setShowTimetableForm(false); fetchContent(); }} />
              </div>
            )}
            {!showTimetableForm && (
              <>
                {timetables.length === 0 ? (
                  <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                    <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No classes scheduled</p>
                    <p className="text-gray-500 mt-2">Click "Add Class" to create your timetable</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {DAYS.map((day) => {
                      const dayClasses = timetables.filter((t) => t.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
                      if (dayClasses.length === 0) return null;
                      return (
                        <div key={day} className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-indigo-500/50 transition-all">
                          <h3 className="text-lg font-bold text-indigo-400 mb-4 pb-3 border-b border-white/10">{day}</h3>
                          <div className="space-y-3">
                            {dayClasses.map((cls) => (
                              <div key={cls.id} className="group flex items-start justify-between border-l-2 border-indigo-500 pl-4 py-2 hover:bg-white/5 rounded-r-lg transition-all">
                                <div>
                                  <p className="font-semibold text-white">{cls.title}</p>
                                  {cls.subject && <p className="text-sm text-gray-400">{cls.subject}</p>}
                                  <p className="text-xs text-indigo-400 mt-1">{cls.start_time} - {cls.end_time}</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (confirm('Delete this class?')) {
                                      await supabase.from('timetables').delete().eq('id', cls.id);
                                      fetchContent();
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'quizzes':
        return (
          <div key="quizzes" className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <QuizBuilder userId={user?.id} onClose={() => setShowQuizBuilder(false)} />
          </div>
        );

      case 'students':
        return user ? (
          <div key="students" className="space-y-6">
            <MyStudents teacherId={user.id} onStartChat={handleStartChat} />
          </div>
        ) : null;

      case 'profile':
        return (
          <div key="profile" className="space-y-6">
            <TeacherProfile userId={user?.id} onClose={() => setActiveTab('notes')} />
          </div>
        );

      case 'messages':
        return user ? (
          <div key="messages" className="space-y-6">
            <MessagingCenter
              userId={user.id}
              userRole="teacher"
              userName={userProfile?.full_name || ''}
              initialChatUserId={chatUserId}
            />
          </div>
        ) : null;

      case 'events':
        return user ? (
          <div key="events" className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <EventManager userRole="teacher" userId={user.id} userName={userProfile?.full_name} />
          </div>
        ) : null;

      case 'notifications':
        return (
          <div key="notifications" className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">All Notifications</h2>
              {allNotifications.length > 0 && (
                <button
                  onClick={async () => {
                    await supabase.from('notifications').update({ is_read: true }).neq('is_read', true);
                    fetchNotifications();
                  }}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>
            
            {allNotifications.length === 0 ? (
              <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No notifications yet</p>
                <p className="text-gray-500 text-sm mt-2">Notifications will appear here when you create content</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {allNotifications.map((notif, idx) => (
                  <div
                    key={notif.id}
                    onClick={async () => {
                      if (!notif.is_read) {
                        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
                        fetchNotifications();
                      }
                    }}
                    className={`relative overflow-hidden bg-white/5 backdrop-blur-xl rounded-2xl p-5 border transition-all hover:border-indigo-500/30 cursor-pointer animate-[fadeIn_0.3s_ease-out] ${
                      notif.is_read ? 'border-white/5' : 'border-indigo-500/30 bg-indigo-500/5'
                    }`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {!notif.is_read && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        notif.type === 'note' ? 'bg-blue-500/20' :
                        notif.type === 'assignment' ? 'bg-amber-500/20' :
                        notif.type === 'class' ? 'bg-emerald-500/20' :
                        notif.type === 'quiz' ? 'bg-purple-500/20' :
                        'bg-gray-500/20'
                      }`}>
                        {notif.type === 'note' ? <FileText className="w-5 h-5 text-blue-400" /> :
                         notif.type === 'assignment' ? <Calendar className="w-5 h-5 text-amber-400" /> :
                         notif.type === 'class' ? <Clock className="w-5 h-5 text-emerald-400" /> :
                         notif.type === 'quiz' ? <Brain className="w-5 h-5 text-purple-400" /> :
                         <Bell className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-white">{notif.title}</h4>
                          {!notif.is_read && (
                            <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 animate-pulse mt-2" />
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{notif.message}</p>
                        <p className="text-gray-500 text-xs mt-2">
                          {new Date(notif.created_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'marks':
        return (
          <div className="space-y-6">
            {showMarkEntry ? (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <TeacherMarkEntry 
                  teacherId={user?.id || ''}
                  onClose={() => setShowMarkEntry(false)}
                />
              </div>
            ) : (
              <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10">
                <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Exam Marks Entry</h3>
                <p className="text-gray-400 mb-6">Enter and manage student marks for closed exams</p>
                <button
                  onClick={() => setShowMarkEntry(true)}
                  className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/30"
                >
                  Enter Marks
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notif, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-[slideIn_0.3s_ease-out] backdrop-blur-sm border border-white/20"
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium">{notif}</span>
          </div>
        ))}
      </div>

      {/* Notifications Toast */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notif, i) => (
            <div
              key={i}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-[slideIn_0.3s_ease-out]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{notif}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Header - Visible only on small screens */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40 lg:hidden">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">Teacher Portal</h1>
                <p className="text-xs text-indigo-300">{userProfile?.full_name || 'Teacher'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Desktop Header - Hidden on mobile */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40 hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Teacher Portal</h1>
              <p className="text-indigo-300 text-sm">{userProfile?.full_name || user?.email}</p>
            </div>
          </div>

          {/* Actions & Profile */}
          <div className="flex items-center gap-3">
            <PwaInstallButton />
            
            {/* Profile Dropdown */}
            <div className="relative">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              onBlur={() => setTimeout(() => setShowProfileDropdown(false), 200)}
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all border border-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-white font-medium text-sm">{userProfile?.full_name || 'Teacher'}</p>
                <p className="text-indigo-300 text-xs">{user?.email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showProfileDropdown && (
              <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-20 sm:top-auto sm:right-0 sm:mt-2 w-auto sm:w-72 bg-gray-900/98 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out] z-50">
                <div className="p-4 border-b border-white/10 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-lg">
                      {userProfile?.avatar_url ? (
                        <img src={userProfile.avatar_url || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-7 h-7 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-lg truncate">{userProfile?.full_name || 'Teacher'}</p>
                      <p className="text-indigo-300 text-sm truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => setShowProfileDropdown(false)}
                      className="sm:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <User className="w-5 h-5" />
                    <span className="font-medium">My Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('notifications');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="font-medium">Notifications</span>
                    {unreadNotifCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">{unreadNotifCount}</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
                  </button>
                </div>
                <div className="p-2 border-t border-white/10">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all font-medium"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-8 py-4 pb-24 md:pb-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-indigo-500/50 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-3xl font-bold text-white">{activeNotes.length}</span>
            </div>
            <p className="text-blue-300 font-medium">Active Notes</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-green-500/50 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-3xl font-bold text-white">{completedCount}</span>
            </div>
            <p className="text-green-300 font-medium">Completed</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-orange-500/50 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <span className="text-3xl font-bold text-white">{upcomingDeadlines}</span>
            </div>
            <p className="text-orange-300 font-medium">Upcoming Due</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-purple-500/50 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-3xl font-bold text-white">{timetables.length}</span>
            </div>
            <p className="text-purple-300 font-medium">Classes</p>
          </div>
        </div>

        {/* Tabs - Hidden on mobile */}
        <div className="hidden lg:flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex gap-2 bg-card/40 backdrop-blur-xl rounded-xl p-1 border border-border/50 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== null && <span className={`px-2 py-0.5 rounded-full text-xs ${tab.id === 'notifications' && unreadNotifCount > 0 ? 'bg-red-500 text-white' : 'bg-white/20'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>
          {activeTab !== 'profile' && activeTab !== 'notifications' && activeTab !== 'students' && activeTab !== 'messages' && activeTab !== 'events' && activeTab !== 'home' && (
            <button
              onClick={() => {
                if (activeTab === 'notes') setShowNoteForm(true);
                else if (activeTab === 'assignments') setShowAssignmentForm(true);
                else if (activeTab === 'timetable') setShowTimetableForm(true);
                else setShowQuizBuilder(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/30"
            >
              <Plus className="w-5 h-5" />
              <span>Add {activeTab === 'notes' ? 'Note' : activeTab === 'assignments' ? 'Assignment' : activeTab === 'timetable' ? 'Class' : 'Quiz'}</span>
            </button>
          )}
        </div>

        {/* Mobile Bottom Navigation - Using centralized component */}
        <div className="lg:hidden">
          <DashboardTabNavigation 
            tabs={tabs as any[]} 
            activeTab={activeTab} 
            onTabChange={(id) => handleTabChange(id)} 
          />
        </div>
        
        {/* Spacer for mobile bottom nav - adjust height based on DashboardTabNavigation */}
        <div className="h-16 lg:hidden" />

        {/* Content */}
        {renderContent()}
      </div>

      {/* Floating Action Button for Mobile */}
      <FloatingActionMenu 
        onAddNote={() => { setActiveTab('notes'); setShowNoteForm(true); }}
        onAddAssignment={() => { setActiveTab('assignments'); setShowAssignmentForm(true); }}
      />
      
      <div className="h-20 lg:hidden" />

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
