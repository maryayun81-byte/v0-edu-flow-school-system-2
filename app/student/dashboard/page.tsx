"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  GraduationCap,
  FileText,
  Calendar,
  Clock,
  Bell,
  BookOpen,
  Trophy,
  Brain,
  LogOut,
  User,
  Users,
  CreditCard,
  Search,
  ChevronRight,
  TrendingUp,
  Target,
  Zap,
  Sparkles,
  Settings,
  MessageSquare,
  CheckCircle,
  Info,
  AlertCircle,
  ShieldAlert,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudentProfileModal from "@/components/StudentProfileModal";
import StudentIDCard from "@/components/StudentIDCard";
import QuizPlayer from "@/components/QuizPlayer";
import Leaderboard from "@/components/Leaderboard";
import EventManager from "@/components/EventManager";
import TuitionManager from "@/components/TuitionManager";
import StudentSettings from "@/components/StudentSettings";
import MessagingCenter from "@/components/MessagingCenter";
import { StudentDashboardSkeleton } from "@/components/DashboardSkeleton";
import StudentTranscriptViewer from "@/components/StudentTranscriptViewer";
import StudentResults from "@/components/StudentResults";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StudentProfile {
  id: string;
  full_name: string;
  username?: string;
  email?: string;
  admission_number: string;
  school_name: string;
  form_class: string;
  subjects: string[];
  profile_completed: boolean;
  avatar_url?: string;
  theme?: string;
  created_at: string;
}

interface Note {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  is_completed: boolean;
}

interface TimetableEntry {
  id: string;
  title: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subject: string;
  class_date?: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  is_published: boolean;
  question_count?: number;
}

interface QuizResult {
  id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_marks: number;
  percentage: number;
  submitted_at: string;
  teacher_remarks?: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [timetableFilter, setTimetableFilter] = useState<'my_subjects' | 'full_class'>('full_class');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "notes" | "assignments" | "timetable" | "quizzes" | "results" | "leaderboard" | "messages" | "events" | "payments" | "id-card" | "settings" | "notifications"
  >("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [transcriptFilters, setTranscriptFilters] = useState({ year: "", term: "", exam: "" });

  useEffect(() => {
    // Auth is handled by layout.tsx - just load profile
    loadProfile();
    
    // Load saved timetable filter preference
    const savedFilter = localStorage.getItem('timetable-filter-mode');
    if (savedFilter === 'my_subjects' || savedFilter === 'full_class') {
      setTimetableFilter(savedFilter);
    }
  }, []);

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Layout will handle redirect
      setLoading(false);
      return;
    }

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      // Apply saved theme if available
      if (profileData.theme) {
        localStorage.setItem("eduflow-theme", profileData.theme);
        document.documentElement.classList.remove(
          "theme-light", "theme-dark", "theme-sakura", 
          "theme-ocean", "theme-forest", "theme-nebula", "theme-sunset"
        );
        document.documentElement.classList.add(`theme-${profileData.theme}`);
      }
      if (!profileData.profile_completed) {
        setShowProfileModal(true);
      }
    } else {
      // Create a basic profile if one doesn't exist yet
      const admissionNumber = `ADM-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000).toString().padStart(4, "0")}`;
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Student",
          role: "student",
          admission_number: admissionNumber,
          theme: "dark",
          profile_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (newProfile) {
        setProfile(newProfile);
      } else if (createError) {
        console.error("[v0] Profile creation error:", createError);
      }
      setShowProfileModal(true);
    }

    // Fetch content - pass profileData so it has access to form_class
    await fetchContent(profileData);
    await fetchNotifications(profileData?.id || session.user.id);
    setLoading(false);
  }

  async function fetchNotifications(userId: string) {
    // Get unread count
    const { data: countData } = await supabase.rpc('get_unread_notification_count', { p_user_id: userId });
    setUnreadCount(countData || 0);

    // Get notifications
    const { data: notifs } = await supabase
      .from('notifications')
      .select(`
        *,
        read_status:notification_reads!left(read_at)
      `)
      .order('created_at', { ascending: false });

    if (notifs) {
      // Filter client-side for audience logic that RLS might cover but we want to be explicit
      // Note: RLS already handles the main security. This is for visual processing if needed.
      const processedInfos = notifs.map(n => ({
        ...n,
        is_read: n.read_status.length > 0
      }));
      setNotificationsList(processedInfos);
    }

    // Subscribe to real-time updates
    const channel = supabase
      .channel('student-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        // Optimistic update or refetch
        fetchNotifications(userId);
        addNotification("New notification received!");
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }

  async function markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notification_reads')
      .insert({ notification_id: notificationId, user_id: profile?.id });
    
    if (!error) {
      setNotificationsList(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }

  async function fetchTranscripts() {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("transcripts")
      .select(`
        *,
        exams!inner(exam_name, academic_year, term, start_date, end_date)
      `)
      .eq("student_id", profile.id)
      .eq("status", "Published")
      .order("published_at", { ascending: false });

    if (data) {
      setTranscripts(data);
    } else if (error) {
      console.error("Error fetching transcripts:", error);
    }
  }

  useEffect(() => {
    if (profile && activeTab === "results") {
      fetchTranscripts();
    }
  }, [profile, activeTab]);

  async function fetchContent(profileData?: any) {
    const currentProfile = profileData || profile;
    const [notesRes, assignmentsRes, quizzesRes] = await Promise.all([
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("assignments").select("*").eq("is_archived", false).order("due_date", { ascending: true }),
      supabase.from("quizzes").select("*").eq("is_published", true).order("created_at", { ascending: false }),
    ]);

    if (notesRes.data) setNotes(notesRes.data);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data);
    
    // Fetch timetable sessions for student's class
    if (currentProfile?.form_class) {
      console.log('[Student Timetable] Student form_class:', currentProfile.form_class);
      
      // First get the class_id from the classes table
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('name', currentProfile.form_class)
        .single();

      console.log('[Student Timetable] Class lookup result:', { classData, classError });

      if (classData) {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('timetable_sessions')
          .select('*')
          .eq('class_id', classData.id)
          .in('status', ['published', 'locked'])
          .order('day_of_week')
          .order('start_time');

        console.log('[Student Timetable] Sessions query result:', { 
          sessionsCount: sessionsData?.length || 0, 
          sessionsError,
          classId: classData.id 
        });

        if (sessionsData && sessionsData.length > 0) {
          // Transform to match old timetable structure
          const transformedData = sessionsData.map(session => ({
            id: session.id,
            title: session.subject,
            day_of_week: session.day_of_week,
            start_time: session.start_time,
            end_time: session.end_time,
            subject: session.subject,
            class_date: undefined,
          }));
          console.log('[Student Timetable] Setting timetable with', transformedData.length, 'sessions');
          setTimetable(transformedData);
        } else {
          console.log('[Student Timetable] No sessions found or empty result');
          setTimetable([]);
        }
      } else {
        console.log('[Student Timetable] No matching class found for form_class:', currentProfile.form_class);
        setTimetable([]);
      }
    } else {
      console.log('[Student Timetable] No form_class in profile');
    }
    
    if (quizzesRes.data) {
      const quizzesWithCount = await Promise.all(
        quizzesRes.data.map(async (quiz) => {
          const { count, error } = await supabase
            .from("quiz_questions")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id);
          
          if (error) {
            console.error(`Error counting questions for quiz ${quiz.id}:`, error);
          }
          
          return { ...quiz, question_count: count || 0 };
        })
      );
      setQuizzes(quizzesWithCount);
    }

    // Fetch quiz results for this student
    if (currentProfile?.id) {
      const { data: resultsData } = await supabase
        .from('quiz_submissions')
        .select(`
          id,
          quiz_id,
          score,
          total_marks,
          submitted_at,
          teacher_remarks,
          quizzes(title)
        `)
        .eq('student_id', currentProfile.id)
        .order('submitted_at', { ascending: false });

      if (resultsData) {
        const formattedResults = resultsData.map((result: any) => ({
          id: result.id,
          quiz_id: result.quiz_id,
          quiz_title: result.quizzes?.[0]?.title || 'Unknown Quiz',
          score: result.score || 0,
          total_marks: result.total_marks || 0,
          percentage: result.total_marks ? Math.round((result.score / result.total_marks) * 100) : 0,
          submitted_at: result.submitted_at,
          teacher_remarks: result.teacher_remarks,
        }));
        setQuizResults(formattedResults);
      }
    }
  }

  function handleProfileComplete() {
    setShowProfileModal(false);
    loadProfile();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function addNotification(message: string) {
    setNotifications((prev) => [...prev, message]);
    setTimeout(() => setNotifications((prev) => prev.slice(1)), 4000);
  }

  const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  
  // Filter today's classes based on filter preference
  const todayClasses = timetable.filter((t) => {
    const isToday = t.day_of_week === todayDay;
    if (!isToday) return false;
    
    if (timetableFilter === 'my_subjects') {
      return profile?.subjects?.some((subject: string) => 
        subject.toLowerCase().trim() === t.subject.toLowerCase().trim()
      );
    }
    return true;
  });

  const pendingAssignments = assignments.filter((a) => !a.is_completed && new Date(a.due_date) > new Date());
  const overdueCount = assignments.filter((a) => !a.is_completed && new Date(a.due_date) < new Date()).length;

  // Quiz taking mode
  if (selectedQuiz && profile) {
    return (
      <QuizPlayer
        quizId={selectedQuiz.id}
        studentName={profile.full_name}
        onComplete={(score, total) => {
          addNotification(`Quiz completed! You scored ${score}/${total} points!`);
          fetchContent(); // Reload data to update results tab
        }}
        onExit={() => setSelectedQuiz(null)}
      />
    );
  }

  if (loading) {
    return <StudentDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Profile Completion Modal */}
      {showProfileModal && profile && (
        <StudentProfileModal
          userId={profile.id}
          onComplete={handleProfileComplete}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notif, idx) => (
          <div
            key={idx}
            className="bg-accent text-foreground px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-[slideIn_0.3s_ease-out]"
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium">{notif}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-chart-3 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-foreground">Student Portal</h1>
                <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
              </div>
            </div>

            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes, assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted border-border/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setActiveTab("id-card")}
              >
                <CreditCard className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 lg:py-6 pb-24 lg:pb-6">
        {/* Navigation Tabs - Hidden on mobile */}
        <div className="hidden lg:flex gap-2 mb-3 sm:mb-4 lg:mb-6 overflow-x-auto pb-2">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
            { id: "notes", label: "Notes", icon: FileText },
            { id: "assignments", label: "Tasks", icon: Target },
            { id: "timetable", label: "Schedule", icon: Calendar },
            { id: "quizzes", label: "Quizzes", icon: Brain },
            { id: "results", label: "Results", icon: Trophy },
            { id: "leaderboard", label: "Rankings", icon: Trophy },
            { id: "messages", label: "Messages", icon: MessageSquare },
            { id: "events", label: "Events", icon: Calendar },
            { id: "payments", label: "Fees", icon: CreditCard },
            { id: "id-card", label: "ID Card", icon: CreditCard },
            { id: "settings", label: "Settings", icon: Settings },
            { id: "notifications", label: "Notifications", icon: Bell },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === "notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card/95 backdrop-blur-xl border-t border-border/50">
          <div className="flex items-center justify-around px-2 py-2">
            {[
              { id: "overview", label: "Home", icon: TrendingUp },
              { id: "notes", label: "Notes", icon: FileText },
              { id: "timetable", label: "Schedule", icon: Calendar },
              { id: "notifications", label: "Alerts", icon: Bell },
              { id: "messages", label: "Messages", icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as typeof activeTab);
                  setShowMoreMenu(false);
                }}
                className={`relative flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
                {tab.id === "notifications" && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-3 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[8px] text-white animate-pulse shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
            {/* More Menu Button */}
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all duration-200 ${
                showMoreMenu
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">More</span>
            </button>
          </div>
        </nav>

        {/* More Menu Modal */}
        {showMoreMenu && (
          <div 
            className="fixed inset-0 z-40 lg:hidden bg-background/80 backdrop-blur-sm"
            onClick={() => setShowMoreMenu(false)}
          >
            <div 
              className="absolute bottom-16 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 rounded-t-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">More Options</h3>
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "assignments", label: "Tasks", icon: Target },
                    { id: "quizzes", label: "Quizzes", icon: Brain },
                    { id: "results", label: "Results", icon: Trophy },
                    { id: "notifications", label: "Alerts", icon: Bell },
                    { id: "leaderboard", label: "Rankings", icon: Trophy },
                    { id: "events", label: "Events", icon: Calendar },
                    { id: "payments", label: "Fees", icon: CreditCard },
                    { id: "id-card", label: "ID Card", icon: CreditCard },
                    { id: "settings", label: "Settings", icon: Settings },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id as typeof activeTab);
                        setShowMoreMenu(false);
                      }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                        activeTab === item.id
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon className="w-6 h-6" />
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4 sm:space-y-6">
            {/* Welcome Card */}
            <div className="bg-gradient-to-br from-chart-3/20 to-accent/10 rounded-2xl p-6 border border-chart-3/20">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Welcome back, {profile?.full_name?.split(" ")[0]}!
                  </h2>
                  <p className="text-muted-foreground">
                    {profile?.form_class} at {profile?.school_name}
                  </p>
                  <p className="text-sm text-chart-3 font-mono mt-2">
                    ID: {profile?.admission_number}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <Sparkles className="w-12 h-12 text-chart-3/50" />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{notes.length}</p>
                <p className="text-sm text-muted-foreground">Study Materials</p>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-3/20 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-chart-3" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{pendingAssignments.length}</p>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-accent" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{quizzes.length}</p>
                <p className="text-sm text-muted-foreground">Available Quizzes</p>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-destructive/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-destructive" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{todayClasses.length}</p>
                <p className="text-sm text-muted-foreground">Classes Today</p>
              </div>
            </div>

            {/* Today's Schedule */}
            {todayClasses.length > 0 && (
              <div className="bg-card border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Today's Schedule
                </h3>
                <div className="space-y-3">
                  {todayClasses.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="text-sm font-mono text-muted-foreground w-24">
                        {entry.start_time} - {entry.end_time}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{entry.title}</p>
                        <p className="text-sm text-muted-foreground">{entry.subject}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Assignments */}
            {pendingAssignments.length > 0 && (
              <div className="bg-card border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-chart-3" />
                  Upcoming Tasks
                </h3>
                <div className="space-y-3">
                  {pendingAssignments.slice(0, 3).map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-foreground">{assignment.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            {notes.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No study materials available yet</p>
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-card border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-all"
                >
                  <h3 className="font-semibold text-foreground mb-2">{note.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {note.description}
                  </p>
                  {note.file_url && (
                    <a
                      href={note.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <BookOpen className="w-4 h-4" />
                      View Document
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No assignments available yet</p>
              </div>
            ) : (
              assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`bg-card border rounded-xl p-5 ${
                    assignment.is_completed
                      ? "border-accent/50 bg-accent/5"
                      : new Date(assignment.due_date) < new Date()
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assignment.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        assignment.is_completed
                          ? "bg-accent/20 text-accent"
                          : new Date(assignment.due_date) < new Date()
                          ? "bg-destructive/20 text-destructive"
                          : "bg-chart-3/20 text-chart-3"
                      }`}
                    >
                      {assignment.is_completed
                        ? "Completed"
                        : new Date(assignment.due_date) < new Date()
                        ? "Overdue"
                        : "Pending"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
              <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
                {unreadCount} Unread
              </div>
            </div>

            {notificationsList.length === 0 ? (
              <div className="text-center py-20 bg-gradient-to-br from-card/50 to-accent/5 backdrop-blur-xl rounded-2xl border border-border/50">
                <BellRing className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-50 animate-pulse" />
                <p className="text-xl font-semibold text-foreground mb-2">All Caught Up!</p>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  You have no new notifications. Information from your teachers and admin will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notificationsList.map((notif) => {
                  const getTypeStyles = (type: string) => {
                    switch (type) {
                      case 'success': 
                        return { 
                          icon: CheckCircle, 
                          color: "text-green-500", 
                          bg: "bg-green-500/10",
                          border: "border-green-500/20"
                        };
                      case 'warning': 
                        return { 
                          icon: AlertCircle, 
                          color: "text-amber-500", 
                          bg: "bg-amber-500/10",
                          border: "border-amber-500/20"
                        };
                      case 'urgent': 
                        return { 
                          icon: ShieldAlert, 
                          color: "text-red-500", 
                          bg: "bg-red-500/10",
                          border: "border-red-500/20"
                        };
                      default: 
                        return { 
                          icon: Info, 
                          color: "text-blue-500", 
                          bg: "bg-blue-500/10",
                          border: "border-blue-500/20"
                        };
                    }
                  };

                  const styles = getTypeStyles(notif.type);
                  const Icon = styles.icon;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                      className={`relative group overflow-hidden rounded-2xl p-6 transition-all duration-300 ${
                        notif.is_read 
                          ? "bg-card/50 border border-border/40 opacity-75 hover:opacity-100" 
                          : "bg-card/90 border border-primary/20 shadow-lg hover:shadow-xl hover:scale-[1.01] cursor-pointer"
                      }`}
                    >
                      {/* Unread Indicator Dot */}
                      {!notif.is_read && (
                        <div className="absolute top-6 right-6 w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                      )}

                      <div className="flex gap-5">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${styles.bg} ${styles.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between pr-8">
                            <h3 className={`font-semibold text-lg ${notif.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {notif.title}
                            </h3>
                            <span className="text-xs text-muted-foreground font-mono">
                              {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <p className={`text-base leading-relaxed ${notif.is_read ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>
                            {notif.message}
                          </p>

                          {!notif.is_read && (
                            <p className="text-xs text-primary font-medium mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to mark as read
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Timetable Tab - Premium Version */}
        {activeTab === "timetable" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* View Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Filter Toggle */}
              <div className="flex items-center gap-2 bg-card/50 backdrop-blur-xl rounded-xl p-1 border border-border/50 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTimetableFilter('my_subjects');
                    localStorage.setItem('timetable-filter-mode', 'my_subjects');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    timetableFilter === 'my_subjects'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <User className="w-4 h-4" />
                  My Subjects
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimetableFilter('full_class');
                    localStorage.setItem('timetable-filter-mode', 'full_class');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    timetableFilter === 'full_class'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Full Class
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 bg-card/50 backdrop-blur-xl rounded-xl p-1 border border-border/50 shadow-lg">
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-primary-foreground"
                >
                  <Calendar className="w-4 h-4" />
                  Weekly
                </button>
              </div>
            </div>

            {/* Timetable Display */}
            {timetable.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-card/50 to-accent/5 backdrop-blur-xl rounded-2xl border border-border/50">
                <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold text-foreground mb-2">No Classes Scheduled</p>
                <p className="text-sm text-muted-foreground">Your timetable will appear here once published</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Weekly View - Desktop */}
                <div className="hidden md:grid md:grid-cols-7 gap-3">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const daySessions = timetable.filter(t => t.day_of_week === day);
                    const filteredSessions = timetableFilter === 'my_subjects' 
                      ? daySessions.filter(s => 
                          profile?.subjects?.some((subject: string) => 
                            subject.toLowerCase().trim() === s.subject.toLowerCase().trim()
                          )
                        )
                      : daySessions;
                    return (
                      <div key={day} className="space-y-2">
                        {/* Sticky Header */}
                        <div className="sticky top-0 z-10 bg-gradient-to-br from-primary/10 to-accent/5 backdrop-blur-xl rounded-xl p-3 border border-primary/20 shadow-lg">
                          <h3 className="font-bold text-foreground text-center text-sm">{day.substring(0, 3)}</h3>
                          <p className="text-xs text-muted-foreground text-center">{filteredSessions.length} classes</p>
                        </div>
                        {/* Sessions */}
                        <div className="space-y-2">
                          {filteredSessions.map(session => (
                            <div
                              key={session.id}
                              className="group relative bg-gradient-to-br from-card/80 to-accent/5 backdrop-blur-xl rounded-xl p-3 border border-border/50 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
                            >
                              {/* Hover Tooltip */}
                              <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-3 bg-popover/95 backdrop-blur-xl rounded-lg shadow-2xl border border-border z-20 min-w-[200px]">
                                <p className="text-xs font-semibold text-foreground mb-1">{session.subject}</p>
                                <p className="text-xs text-muted-foreground">Time: {session.start_time} - {session.end_time}</p>
                                <p className="text-xs text-muted-foreground">Class: {session.title}</p>
                              </div>
                              
                              <div className="font-semibold text-sm text-foreground truncate mb-1">{session.subject}</div>
                              <div className="text-xs text-muted-foreground font-mono">{session.start_time} - {session.end_time}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile View - Vertical Cards */}
                <div className="md:hidden space-y-4">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const daySessions = timetable.filter(t => t.day_of_week === day);
                    const filteredSessions = timetableFilter === 'my_subjects' 
                      ? daySessions.filter(s => profile?.subjects?.includes(s.subject))
                      : daySessions;
                    if (filteredSessions.length === 0) return null;
                    
                    return (
                      <div key={day} className="bg-gradient-to-br from-card/50 to-accent/5 backdrop-blur-xl rounded-2xl border border-border/50 overflow-hidden shadow-lg">
                        {/* Sticky Day Header */}
                        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/20 to-accent/10 backdrop-blur-xl p-4 border-b border-border/50">
                          <h3 className="font-bold text-foreground text-lg">{day}</h3>
                          <p className="text-sm text-muted-foreground">{filteredSessions.length} classes scheduled</p>
                        </div>
                        {/* Session Cards */}
                        <div className="p-4 space-y-3">
                          {filteredSessions.map((session, idx) => (
                            <div
                              key={session.id}
                              className="bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border/50 shadow-md hover:shadow-lg transition-all duration-300"
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground text-base mb-1">{session.subject}</h4>
                                  <p className="text-sm text-muted-foreground">{session.title}</p>
                                </div>
                                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                                  {session.start_time}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{session.start_time} - {session.end_time}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quizzes Tab */}
        {activeTab === "quizzes" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No quizzes available yet</p>
              </div>
            ) : (
              quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-card border border-border/50 rounded-xl p-5"
                >
                  <h3 className="font-semibold text-foreground mb-2">{quiz.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {quiz.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span>{quiz.question_count || 0} questions</span>
                    {quiz.time_limit_minutes && (
                      <span>{quiz.time_limit_minutes} min</span>
                    )}
                  </div>
                  <Button
                    onClick={() => setSelectedQuiz(quiz)}
                    className="w-full bg-accent hover:bg-accent/90"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Start Quiz
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

{/* Leaderboard Tab */}
  {activeTab === "leaderboard" && <Leaderboard currentStudentName={profile?.full_name} />}

  {/* Messages Tab */}
  {activeTab === "messages" && profile && (
    <MessagingCenter userId={profile.id} userRole="student" userName={profile.full_name} />
  )}

  {/* Events Tab */}
  {activeTab === "events" && profile && (
    <EventManager userRole="student" userId={profile.id} userName={profile.full_name} />
  )}

  {/* Payments Tab */}
  {activeTab === "payments" && profile && (
    <TuitionManager userRole="student" userId={profile.id} studentAdmissionNumber={profile.admission_number} />
  )}
  
  {/* ID Card Tab */}
        {activeTab === "id-card" && profile && (
          <div className="flex justify-center py-8">
            <StudentIDCard
              fullName={profile.full_name}
              admissionNumber={profile.admission_number}
              schoolName={profile.school_name}
              formClass={profile.form_class}
              subjects={profile.subjects || []}
              avatarUrl={profile.avatar_url}
              createdAt={profile.created_at}
            />
          </div>
        )}

        {/* Results Tab */}
        {activeTab === "results" && profile?.id && (
          <StudentResults studentId={profile.id} />
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && profile && (
          <StudentSettings
            profile={profile}
            onProfileUpdate={loadProfile}
          />
        )}
      </div>
    </div>
  );
}
