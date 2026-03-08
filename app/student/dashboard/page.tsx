"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  TrendingDown,
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
  Menu,
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
import StudentAssignmentsManager from "@/components/StudentAssignmentsManager";
import StudentNotesManager from "@/components/StudentNotesManager";
import StudentCalendar from "@/components/StudentCalendar";
import StudentUpcomingExams from "@/components/StudentUpcomingExams";
import StudentAttendanceSummary from "@/components/student/StudentAttendanceSummary";
import AttendanceOverviewCard from "@/components/student/AttendanceOverviewCard";
import { CognitiveCore, PredictionResult, ClassificationZone } from "@/lib/ai/CognitiveCore";


const supabase = createClient();

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

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: string;
  payload?: any;
  is_read?: boolean;
}

interface Transcript {
  id: string;
  student_id: string;
  exam_id: string;
  status: string;
  published_at: string;
  exams: {
    exam_name: string;
    academic_year: string;
    term: string;
    start_date: string;
    end_date: string;
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StudentDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    async function init() {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (error || !authUser) {
          router.replace('/student/login');
          return;
        }
      } catch (err) {
        console.error("Dashboard init error:", err);
        router.replace('/student/login');
      }
    }
    init();
  }, [router]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [timetableFilter, setTimetableFilter] = useState<'my_subjects' | 'full_class'>('full_class');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsList, setNotificationsList] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "notes" | "assignments" | "timetable" | "quizzes" | "results" | "leaderboard" | "messages" | "events" | "payments" | "id-card" | "settings" | "notifications" | "attendance"
  >((searchParams?.get("tab") as "overview") || "overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [transcriptFilters, setTranscriptFilters] = useState({ year: "", term: "", exam: "" });
  const [inference, setInference] = useState<PredictionResult | null>(null);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

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
    
    // Perform Cognitive Inference
    if (profileData) {
      const signals = await CognitiveCore.fetchStudentSignals(profileData.id);
      const result = await CognitiveCore.infer(profileData.id, signals);
      setInference(result);
    }

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
      const processedInfos = notifs.map((n: any) => ({
        ...n,
        is_read: n.read_status && n.read_status.length > 0
      })) as Notification[];
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
    if (!currentProfile?.id) return;

    // 1. Fetch Class Enrollments
    const { data: enrollments } = await supabase
      .from('student_classes')
      .select('class_id')
      .eq('student_id', currentProfile.id);
    
    
    const classIds = enrollments?.map((e: { class_id: string }) => e.class_id) || [];

    // 2. Fetch Content with class filters
    const [notesRes, assignmentsRes, quizzesRes] = await Promise.all([
      supabase
        .from("notes")
        .select("*")
        .in("class_id", classIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("assignments")
        .select("*")
        .in("class_id", classIds)
        .eq("status", "PUBLISHED")
        .order("due_date", { ascending: true }),
      supabase
        .from("quizzes")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
    ]);

    if (notesRes.data) setNotes(notesRes.data);
    
    // Process assignments to check for submissions
    if (assignmentsRes.data) {
        // Fetch the user's submissions to map status
        const { data: subs } = await supabase
            .from('student_submissions')
            .select('assignment_id')
            .eq('student_id', currentProfile.id);
        
        const submittedIds = new Set(subs?.map((s: { assignment_id: string }) => s.assignment_id) || []);
        
        const processedAssignments = assignmentsRes.data.map((a: Assignment) => ({
            ...a,
            is_completed: submittedIds.has(a.id)
        }));
        setAssignments(processedAssignments);
    }
    
    // 4. Fetch Timetable Sessions (Robust ID-based)
    if (classIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('timetable_sessions')
        .select('*')
        .in('class_id', classIds)
        .in('status', ['published', 'locked'])
        .order('day_of_week')
        .order('start_time');

      if (sessionsData) {
        const transformedData = sessionsData.map((session: { id: string; subject: string; day_of_week: string; start_time: string; end_time: string }) => ({
          id: session.id,
          title: session.subject,
          day_of_week: session.day_of_week,
          start_time: session.start_time,
          end_time: session.end_time,
          subject: session.subject,
        }));
        setTimetable(transformedData);
      }
    }
    
    if (quizzesRes.data) {
      const quizzesWithCount = await Promise.all(
        quizzesRes.data.map(async (quiz: any) => {
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
      const mySubjects = profile?.subjects || [];
      return mySubjects.length === 0 || mySubjects.some((subject: string) => 
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
            { id: "assignments", label: "Assignments", icon: Target },
            { id: "timetable", label: "Schedule", icon: Calendar },
            { id: "attendance", label: "Attendance", icon: BookOpen },
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
              { id: "timetable", label: "Schedule", icon: Calendar },
              { id: "notifications", label: "Alerts", icon: Bell },
              { id: "messages", label: "Messages", icon: MessageSquare },
              { id: "more", label: "More", icon: Menu },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                   if (tab.id === 'more') {
                     setShowMoreMenu(!showMoreMenu);
                   } else {
                     setActiveTab(tab.id as typeof activeTab);
                     setShowMoreMenu(false);
                   }
                }}
                type="button"
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
                    { id: "notes", label: "Notes", icon: FileText },
                    { id: "assignments", label: "Assignments", icon: Target },
                    { id: "attendance", label: "Attendance", icon: BookOpen },
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

        {activeTab === "overview" && (
          <div className="space-y-12 sm:space-y-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* 0. Immersive Welcome Header */}
            <div className="relative overflow-hidden bg-card rounded-[3rem] p-10 border border-border/50 shadow-2xl group">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px] group-hover:bg-primary/30 transition-all duration-1000 animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/20 rounded-full blur-[120px] group-hover:bg-accent/30 transition-all duration-1000" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-muted/50 border border-border/50 rounded-full backdrop-blur-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase text-muted-foreground/80">Systems Optimal • Cognitive Core Active</span>
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter leading-tight">
                    Hello, <span className="text-primary">{profile?.full_name?.split(" ")[0]}</span>
                    <span className="block text-xl md:text-2xl font-medium text-muted-foreground tracking-tight mt-2 italic">Ready for today's learning adventure?</span>
                  </h1>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Session ID</p>
                    <p className="text-sm font-mono text-primary/60">{profile?.admission_number}</p>
                  </div>
                  <div className="w-24 h-24 p-1.5 bg-gradient-to-br from-primary via-accent to-primary rounded-[2rem] shadow-2xl shadow-primary/20 hover:scale-105 transition-transform duration-700">
                    <div className="w-full h-full rounded-[1.7rem] bg-card flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-3xl font-black text-primary">
                          {profile?.full_name?.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 1. Unified Success Index (Top Priority - Visually Dominant) */}
            {inference && (
              <div className="relative flex flex-col items-center justify-center text-center py-10 px-6 sm:py-16 bg-gradient-to-b from-primary/10 via-background to-background rounded-[3rem] border border-white/5 shadow-[0_0_100px_rgba(var(--primary),0.05)] overflow-hidden">
                {/* Core Brain Visualization Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                
                <div className="relative z-10 space-y-8 w-full max-w-2xl">
                   {/* Motivational Caption */}
                   <div className="space-y-2">
                     <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-muted/50 border border-border/50 rounded-full backdrop-blur-xl mb-4">
                       <Sparkles className="w-4 h-4 text-primary animate-bounce" />
                       <span className="text-[11px] font-black tracking-[0.2em] uppercase text-foreground/80">Intelligent Learning Companion</span>
                     </div>
                     <h2 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-[1.1]">
                        {inference.motivationalCaption}
                     </h2>
                   </div>

                   {/* Radial Progress Engine */}
                   <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto group">
                      <svg className="w-full h-full -rotate-90">
                        {/* Background Path */}
                        <circle cx="50%" cy="50%" r="45%" fill="transparent" stroke="currentColor" strokeWidth="2" className="opacity-[0.05]" />
                        {/* Animated Intelligence Ring */}
                        <circle
                          cx="50%"
                          cy="50%"
                          r="45%"
                          fill="transparent"
                          stroke="url(#luxuryGradient)"
                          strokeWidth="12"
                          strokeDasharray="100%"
                          strokeDashoffset={`${100 - (inference.successScore * 100)}%`}
                          strokeLinecap="round"
                          className="transition-all duration-[3000ms] ease-out shadow-[0_0_30px_rgba(var(--primary),0.5)]"
                          style={{
                             strokeDasharray: "283%", // Approx 2 * PI * 45% of 100
                             strokeDashoffset: `${283 - (283 * inference.successScore)}%`
                          }}
                        />
                        <defs>
                          <linearGradient id="luxuryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--primary)" />
                            <stop offset="50%" stopColor="var(--accent)" />
                            <stop offset="100%" stopColor="var(--primary)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      
                      {/* Inner Data Layer */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         {/* Trajectory Velocity Vector (The One Feature That Makes This Platform Legendary) */}
                         {inference.trajectory && (
                            <div className={`absolute top-14 flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/50 backdrop-blur-md animate-pulse shadow-xl ${
                              inference.trajectory.successGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                               {inference.trajectory.successGain >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                               <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                                 {inference.trajectory.successGain >= 0 ? 'Rising Momentum' : 'Stability Alert'}
                               </span>
                            </div>
                         )}

                         <div className="text-6xl sm:text-8xl font-black text-foreground tracking-tighter tabular-nums drop-shadow-2xl">
                           {Math.round(inference.successScore * 100)}
                         </div>
                         <div className="flex flex-col items-center mt-[-10px]">
                            <div className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-[0.3em]">
                               {inference.progressZoneLabel || "Success Index"}
                            </div>
                            <div className={`mt-3 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-1000 ${
                              inference.successScore > 0.85 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' :
                              inference.successScore > 0.6 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.1)]' :
                              inference.successScore > 0.3 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]' :
                              'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                            }`}>
                               {inference.zone}
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Layer 2: Simple Meaning Statement */}
                   <div className="mt-6 p-6 bg-muted/30 border border-border/50 rounded-2xl backdrop-blur-md max-w-md mx-auto">
                      <p className="text-sm text-foreground/70 font-medium leading-relaxed italic">
                         "{inference.meaningStatement || "Your learning rhythm is being analyzed by the CCIC neural engine."}"
                      </p>
                   </div>
                </div>
              </div>
            )}

            {/* 2. AI Insight Narrative Panel (Mentorship Style) */}
            {inference && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center px-4 sm:px-0">
                <div className="lg:col-span-7 space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                         <Brain className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground uppercase tracking-wider">Mentorship Intelligence</h3>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Real-time Guidance Layer</p>
                      </div>
                   </div>

                   <div className="relative p-8 bg-card border border-border/50 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl group overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                         <Zap className="w-12 h-12 text-primary" />
                      </div>
                      <p className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed tracking-tight italic">
                        "{inference.insights[0]}"
                      </p>
                      <div className="mt-8 flex items-center gap-4">
                         <div className="flex -space-x-2">
                            {[1,2,3].map(i => (
                              <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                                {i}
                              </div>
                            ))}
                         </div>
                         <p className="text-xs text-primary font-black uppercase tracking-widest">Correlated with {Math.round(inference.successScore * 100)}+ metrics</p>
                      </div>
                   </div>
                </div>
                 {/* 3. Risk Signal Indicators (Compact Viz) */}
                 <div className="lg:col-span-5 space-y-8">
                    <h4 className="text-sm font-black text-muted-foreground uppercase tracking-[0.3em]">Performance Guardrails</h4>
                    <div className="grid grid-cols-2 gap-6">
                       {[
                         { label: 'Attendance', value: 1 - inference.riskSignals.attendance, color: 'primary', icon: Clock },
                         { label: 'Payment', value: 1 - inference.riskSignals.payment, color: 'accent', icon: CreditCard },
                         { label: 'Engagement', value: 1 - inference.riskSignals.engagement, color: 'yellow-500', icon: Zap },
                         { label: 'Academic', value: 1 - inference.riskSignals.academic, color: 'emerald-400', icon: TrendingUp }
                       ].map((sig) => (
                         <div key={sig.label} className="space-y-3 group">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <sig.icon className={`w-3.5 h-3.5 text-${sig.color} opacity-70`} />
                                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{sig.label}</span>
                               </div>
                               <span className={`text-xs font-black ${sig.value < 0.5 ? 'text-destructive' : 'text-emerald-400'}`}>
                                 {Math.round(sig.value * 100)}%
                               </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                               <div
                                 className={`h-full rounded-full transition-all duration-1000 group-hover:opacity-80 ${sig.value >= 0.75 ? 'bg-emerald-500' : sig.value >= 0.5 ? 'bg-amber-500' : 'bg-destructive'}`}
                                 style={{ width: `${sig.value * 100}%` }}
                               />
                            </div>
                         </div>
                       ))}
                    </div>
                    <div className="p-4 bg-muted/50 border border-border/50 rounded-2xl">
                       <p className="text-[10px] text-muted-foreground leading-relaxed">
                         Performance indicators are calculated by the CCIC using your real attendance, payment, engagement, and academic data. Green indicates strong performance; red signals areas for improvement.
                       </p>
                    </div>
                 </div>
              </div>
            )}

            {/* 4. Support & Engagement Visualization Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
               {/* Left: Attendance Visualization */}
               <div className="lg:col-span-5">
                  {profile && (
                    <AttendanceOverviewCard 
                      studentId={profile.id} 
                      onViewFull={() => setActiveTab("attendance")}
                    />
                  )}
               </div>

               {/* Right: Quick Intelligence Summary Cards */}
               <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'notes', label: 'Knowledge Base', count: notes.length, icon: BookOpen, sub: 'Available Resources', color: 'from-blue-500/20 to-indigo-500/20' },
                    { id: 'assignments', label: 'Active Missions', count: pendingAssignments.length, icon: Target, sub: 'Pending Submissions', color: 'from-emerald-500/20 to-teal-500/20' },
                    { id: 'quizzes', label: 'Neural Tests', count: quizzes.length, icon: Brain, sub: 'Skills Assessment', color: 'from-purple-500/20 to-pink-500/20' },
                    { id: 'events', label: 'Social Sync', count: 2, icon: Users, sub: 'Upcoming Events', color: 'from-amber-500/20 to-orange-500/20' }
                  ].map((card) => (
                    <div 
                      key={card.id}
                      onClick={() => setActiveTab(card.id as any)}
                      className="group relative overflow-hidden bg-card border border-border/50 rounded-[2rem] p-6 cursor-pointer hover:bg-muted/50 transition-all duration-500"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                      <div className="relative z-10 flex justify-between items-start">
                         <div className="space-y-4">
                            <div className="w-10 h-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                               <card.icon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                               <p className="text-3xl font-black text-foreground tracking-tighter">{card.count}</p>
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{card.label}</p>
                            </div>
                         </div>
                         <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight">{card.sub}</div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* 5. Trend Mini Analytics / Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               {/* Daily Session Re-styled */}
               {todayClasses.length > 0 && (
                 <div className="bg-card border border-border/50 rounded-[3rem] p-8 space-y-8">
                    <div className="flex items-center justify-between">
                       <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-3">
                         <Calendar className="w-5 h-5 text-primary" />
                         Schedule Sync
                       </h3>
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{todayClasses.length} Events Today</p>
                    </div>
                    <div className="space-y-4">
                       {todayClasses.map((session, i) => (
                         <div key={session.id} className="group flex items-center gap-6 p-4 bg-muted/50 rounded-2xl border border-transparent hover:border-primary/20 transition-all">
                            <div className="flex flex-col items-center min-w-[50px]">
                               <span className="text-sm font-black text-foreground">{session.start_time.split(":")[0]}</span>
                               <span className="text-[9px] font-bold text-muted-foreground uppercase">AM</span>
                            </div>
                            <div className="h-10 w-px bg-border/50" />
                            <div className="flex-1">
                               <p className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{session.title}</p>
                               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{session.subject}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                               <ChevronRight className="w-5 h-5 text-primary" />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}

               {/* Recent Mission Briefings */}
               {pendingAssignments.length > 0 && (
                 <div className="bg-card border border-border/50 rounded-[3rem] p-8 space-y-8">
                    <div className="flex items-center justify-between">
                       <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-3">
                         <Target className="w-5 h-5 text-emerald-400" />
                         Mission Intel
                       </h3>
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{pendingAssignments.length} Active</p>
                    </div>
                    <div className="space-y-4">
                       {pendingAssignments.slice(0, 3).map((assignment) => (
                         <div key={assignment.id} onClick={() => setActiveTab("assignments")} className="group flex items-center justify-between p-5 bg-muted/50 rounded-2xl border border-transparent hover:border-emerald-500/20 cursor-pointer transition-all">
                            <div className="space-y-1">
                               <p className="text-base font-bold text-foreground group-hover:text-emerald-400 transition-colors tracking-tight">{assignment.title}</p>
                               <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due in {new Date(assignment.due_date).getDate() - new Date().getDate()} days</p>
                               </div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center">
                               <ChevronRight className="w-4 h-4 text-emerald-400 mt-[-2px]" />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && profile && (
          <div className="space-y-4">
            <StudentAttendanceSummary studentId={profile.id} />
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && profile && (
          <StudentNotesManager studentId={profile.id} />
        )}

        {/* Assignments Tab */}
        {activeTab === "assignments" && profile && (
          <StudentAssignmentsManager 
            studentId={profile.id}
            studentClass={profile.form_class}
            className="w-full"
          />
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
                      ? daySessions.filter(s => 
                          profile?.subjects?.some((subject: string) => 
                            subject.toLowerCase().trim() === s.subject.toLowerCase().trim()
                          )
                        )
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
