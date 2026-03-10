"use client";

import { useState, useEffect } from "react";
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
  CheckCircle2,
  Info,
  AlertCircle,
  ShieldAlert,
  BellRing,
  Menu,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import StudentAcademicIntelligence from "@/components/student/StudentAcademicIntelligence";
import { CognitiveCore, PredictionResult, ClassificationZone } from "@/lib/ai/CognitiveCore";
import { ResultsCognitiveCore } from "@/lib/ai/ResultsCognitiveCore";
import ResultsSubmissionModal from "@/components/student/ResultsSubmissionModal";
import { ActiveEventBanner } from "@/components/ActiveEventBanner";
import TuitionEventAd from "@/components/student/TuitionEventAd";
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
  audience?: string;
  target_user_id?: string;
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
    "overview" | "notes" | "assignments" | "timetable" | "quizzes" | "results" | "intelligence" | "leaderboard" | "messages" | "events" | "payments" | "id-card" | "settings" | "notifications" | "attendance"
  >((searchParams?.get("tab") as "overview") || "overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [transcriptFilters, setTranscriptFilters] = useState({ year: "", term: "", exam: "" });
  const [inference, setInference] = useState<PredictionResult | null>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [hasSubmittedResults, setHasSubmittedResults] = useState(false);
  const [showEventAd, setShowEventAd] = useState(false);
  const [isRegisteredForEvent, setIsRegisteredForEvent] = useState(false);

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
      // RCCIC: Sync and Check Events
      await ResultsCognitiveCore.syncEventStatuses();
      const event = await ResultsCognitiveCore.getActiveEvent();
      if (event) {
        setActiveEvent(event);
        // Check if student already submitted for this event
        const { data: existing } = await supabase
          .from('student_results')
          .select('id')
          .eq('student_id', profileData.id)
          .eq('event_id', event.id)
          .limit(1);
        
        setHasSubmittedResults(existing && existing.length > 0);
      }

      const signals = await CognitiveCore.fetchStudentSignals(profileData.id);
      
      // RCCIC: Cross-Event Performance Analysis
      const resultsMetrics = await ResultsCognitiveCore.analyzeCrossEventPerformance(profileData.id);
      
      // Augment signals with academic performance from results
      const augmentedSignals = {
        ...signals,
        academicPerformanceTrend: resultsMetrics.averageGradeNumeric
      };

      const result = await CognitiveCore.infer(profileData.id, augmentedSignals);
      setInference(result);

      // Check for Tuition Event Ad logic
      await checkEventAdLogic(profileData.id);
    }

    setLoading(false);
  }

  async function checkEventAdLogic(userId: string) {
    try {
      // 1. Find the latest promoted event
      const { data: events } = await supabase
        .from("tuition_events")
        .select("id, classes_allowed")
        .eq("status", "active")
        .eq("is_promoted", true)
        .gte("end_date", new Date().toISOString().split('T')[0])
        .order("start_date", { ascending: true })
        .limit(1);

      if (!events || events.length === 0) return;
      const event = events[0];

      // 2. Check if student is already registered
      const { data: reg } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("student_id", userId)
        .eq("event_id", event.id)
        .limit(1);

      if (reg && reg.length > 0) {
        setIsRegisteredForEvent(true);
        return;
      }

      // 3. Check frequency capping (3x per day)
      const today = new Date().toISOString().split('T')[0];
      const { data: viewData, error: viewErr } = await supabase
        .from("student_event_ad_views")
        .select("view_count")
        .eq("student_id", userId)
        .eq("event_id", event.id)
        .eq("last_view_date", today)
        .single();

      if (viewErr && viewErr.code !== 'PGRST116') throw viewErr;

      const currentCount = viewData?.view_count || 0;

      if (currentCount < 3) {
        setShowEventAd(true);
        // Increment view count
        await supabase
          .from("student_event_ad_views")
          .upsert({
            student_id: userId,
            event_id: event.id,
            last_view_date: today,
            view_count: currentCount + 1
          }, { onConflict: 'student_id,event_id,last_view_date' });
      }
    } catch (err) {
      console.error("Error in checkEventAdLogic:", err);
    }
  }

  // Reactive submission check
  useEffect(() => {
    async function checkSubmission() {
      if (profile?.id && activeEvent?.id) {
        const { data: existing } = await supabase
          .from('student_results')
          .select('id')
          .eq('student_id', profile.id)
          .eq('event_id', activeEvent.id)
          .limit(1);
        setHasSubmittedResults(existing && existing.length > 0);
      }
    }
    checkSubmission();
  }, [profile?.id, activeEvent?.id]);

  const [activitiesList, setActivitiesList] = useState<Notification[]>([]); // New state for personalized activities

  async function fetchNotifications(userId: string) {
    // Get unread count (this RPC handles the role/ID logic internally)
    const { data: countData } = await supabase.rpc('get_unread_notification_count', { p_user_id: userId });
    setUnreadCount(countData || 0);

    // Get notifications with role/individual filtering
    // In a real RLS-heavy app, .select() is enough, but we'll be explicit for safety
    const { data: notifs } = await supabase
      .from('notifications')
      .select(`
        *,
        read_status:notification_reads!left(read_at)
      `)
      .or(`audience.eq.all,audience.eq.student,target_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (notifs) {
      // Process notifications
      const processed = notifs.map((n: any) => ({
        ...n,
        is_read: n.read_status && n.read_status.length > 0
      })) as Notification[];

      // Separate "Activities" (e.g., student-specific actions) from general "Notifications"
      // User specifically asked for tailored activities. 
      // We'll treat notifications with type 'activity' or those sent specifically to this user as activities.
      const activities = processed.filter(n => n.type === 'activity' || n.target_user_id === userId);
      const regularNotifs = processed.filter(n => n.type !== 'activity' && (n.audience === 'all' || n.audience === 'student'));

      setNotificationsList(regularNotifs);
      setActivitiesList(activities);
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
    const { data: initialEnrollments } = await supabase
      .from('student_classes')
      .select('class_id')
      .eq('student_id', currentProfile.id);
    
    let activeEnrollments = initialEnrollments || [];
    
    // Self-healing: if no enrollments but has form_class, try to auto-enroll
    if (activeEnrollments.length === 0 && currentProfile.form_class) {
      const lowerClass = currentProfile.form_class.toLowerCase().trim();
      const { data: classData } = await supabase
        .from('classes')
        .select('id')
        .ilike('name', lowerClass)
        .single();

      if (classData) {
        await supabase
          .from('student_classes')
          .upsert({
            student_id: currentProfile.id,
            class_id: classData.id
          }, { onConflict: 'student_id,class_id' });
        
        // Refresh enrollments
        const { data: refreshed } = await supabase
          .from('student_classes')
          .select('class_id')
          .eq('student_id', currentProfile.id);
        if (refreshed) activeEnrollments = refreshed;
      }
    }
    
    const classIds = activeEnrollments.map((e: { class_id: string }) => e.class_id);

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
      // If student hasn't selected subjects or session has no subject, show it
      if (mySubjects.length === 0 || !t.subject) return true;
      
      return mySubjects.some((subject: string) => 
        subject && t.subject && subject.toLowerCase().trim() === t.subject.toLowerCase().trim()
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
      {/* Tuition Event Ad */}
      {showEventAd && profile && (
        <TuitionEventAd 
          studentId={profile.id}
          studentProfile={profile}
          onClose={() => setShowEventAd(false)}
          onRegisterSuccess={() => {
            setShowEventAd(false);
            setIsRegisteredForEvent(true);
            addNotification("Registration Successful! See you at the event.");
          }}
        />
      )}

      {/* Profile Completion Modal */}
      {showProfileModal && profile && (
        <StudentProfileModal
          userId={profile.id}
          onComplete={handleProfileComplete}
        />
      )}

      {/* RCCIC Results Submission Modal */}
      {showResultsModal && profile && (
        <ResultsSubmissionModal
          studentId={profile.id}
          onClose={() => setShowResultsModal(false)}
          onSuccess={() => {
            setHasSubmittedResults(true);
            loadProfile(); // Refresh intelligence
          }}
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
            { id: "intelligence", label: "Academic Intelligence", icon: Sparkles },
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
                    { id: "intelligence", label: "AI Intelligence", icon: Sparkles },
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* 1. Banner + Welcome Message */}
            <div className="space-y-4">
              {activeEvent && !hasSubmittedResults && (
                <ActiveEventBanner>
                  <Button 
                    onClick={() => setShowResultsModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] px-6 py-2 rounded-xl shadow-lg shadow-blue-600/30 gap-2"
                  >
                    <Trophy className="w-4 h-4" />
                    Submit Your Marks
                  </Button>
                </ActiveEventBanner>
              )}

              <div className="relative overflow-hidden bg-card rounded-[2.5rem] p-8 border border-border/50 shadow-xl group">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="relative z-10 space-y-4">
                  <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter">
                    Good Morning, <span className="text-primary">{profile?.full_name?.split(" ")[0]}</span>!
                  </h2>
                  <div className="max-w-3xl">
                    <p className="text-lg text-muted-foreground font-medium leading-relaxed italic">
                      Here’s today’s schedule and performance updates. Your progress is monitored by RCCIC for excellence.
                    </p>
                    {activeEvent && (
                      <div className="flex items-center gap-2 mt-4">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                         <p className="text-sm font-bold text-primary/80 uppercase tracking-widest">
                            Active Evaluation: {activeEvent.name || activeEvent.event_name}
                         </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Performance Quadrails */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  label: 'Attendance Stability', 
                  value: inference ? `${Math.round((1 - (inference.riskSignals.attendance || 0)) * 100)}%` : '...', 
                  icon: Clock, 
                  color: (inference?.riskSignals.attendance || 0) > 0.3 ? 'text-rose-400' : 'text-emerald-400',
                  bg: 'from-emerald-500/10 to-transparent',
                  tab: 'attendance'
                },
                { 
                  label: 'Engagement Velocity', 
                  value: inference ? `${Math.round((inference.successScore || 0.5) * 100)}%` : '...', 
                  icon: Zap, 
                  color: (inference?.successScore || 0) < 0.4 ? 'text-rose-400' : 'text-indigo-400',
                  bg: 'from-primary/10 to-transparent',
                  tab: 'intelligence'
                },
                { 
                  label: 'Payment Reliability', 
                  value: inference ? `${Math.round((1 - (inference.riskSignals.payment || 0)) * 100)}%` : '...', 
                  icon: CreditCard, 
                  color: (inference?.riskSignals.payment || 0) > 0.5 ? 'text-rose-400' : 'text-blue-400',
                  bg: 'from-blue-500/10 to-transparent',
                  tab: 'payments'
                },
                { 
                  label: 'Academic Trend', 
                  value: inference ? (inference.successScore > 0.6 ? 'Rising' : 'Stable') : '...', 
                  icon: TrendingUp, 
                  color: inference?.successScore ? (inference.successScore > 0.6 ? 'text-emerald-400' : 'text-amber-400') : 'text-muted-foreground',
                  bg: 'from-amber-500/10 to-transparent',
                  tab: 'results'
                }
              ].map((card, i) => (
                <div 
                   key={i} 
                   onClick={() => setActiveTab(card.tab as any)}
                   className="relative overflow-hidden bg-card border border-border/50 rounded-2xl p-6 transition-all hover:scale-[1.02] shadow-sm cursor-pointer group"
                >
                   <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.bg} rounded-full blur-3xl opacity-30`} />
                   <div className="relative z-10 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                         <div className={`p-2 rounded-xl bg-white/5 border border-white/5 ${card.color}`}>
                            <card.icon className="w-5 h-5" />
                         </div>
                         <div className={`w-2 h-2 rounded-full ${card.color.replace('text-', 'bg-')} animate-pulse`} />
                      </div>
                      <div>
                         <p className="text-2xl font-black text-foreground tracking-tighter">{card.value}</p>
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{card.label}</p>
                      </div>
                   </div>
                </div>
              ))}
            </div>

            {/* 2.5 Secondary Quick Actions (Missing Stats) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Available Resources', value: notes.length, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10', tab: 'notes', desc: 'Study notes' },
                  { label: 'Pending Quizzes', value: quizzes.length, icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10', tab: 'quizzes', desc: 'Self-assessment' },
                  { label: 'Active Submissions', value: hasSubmittedResults ? 'Completed' : 'Pending', icon: CheckCircle2, color: hasSubmittedResults ? 'text-emerald-500' : 'text-amber-500', bg: 'bg-emerald-500/10', tab: 'results', desc: 'Event results' }
                ].map((item, i) => (
                   <div 
                      key={i}
                      onClick={() => setActiveTab(item.tab as any)}
                      className="flex items-center gap-4 bg-muted/30 hover:bg-muted/50 border border-border/50 p-5 rounded-3xl transition-all cursor-pointer group"
                   >
                       <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center`}>
                          <item.icon className="w-6 h-6" />
                       </div>
                       <div className="flex-1">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
                          <p className="text-lg font-black text-foreground">{item.value}</p>
                       </div>
                       <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                   </div>
                ))}
            </div>

            {/* Premium Tuition Event Card */}
            <div 
              onClick={() => isRegisteredForEvent ? setActiveTab("events") : setShowEventAd(true)}
              className={cn(
                "relative overflow-hidden border rounded-[2.5rem] p-8 transition-all cursor-pointer group flex items-center justify-between shadow-xl",
                isRegisteredForEvent 
                  ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10" 
                  : "bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 hover:shadow-indigo-500/10 hover:scale-[1.01]"
              )}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
              
              <div className="relative z-10 flex items-center gap-8">
                <div className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 border shadow-2xl transition-transform group-hover:scale-110 duration-500",
                  isRegisteredForEvent 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                    : "bg-indigo-600 text-white border-indigo-400/30"
                )}>
                  {isRegisteredForEvent ? <CheckCircle2 className="w-10 h-10" /> : <Sparkles className="w-10 h-10" />}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      isRegisteredForEvent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
                    )}>
                      {isRegisteredForEvent ? "Status: Registered" : "Premium Event"}
                    </span>
                    {!isRegisteredForEvent && (
                      <div className="px-3 py-1 bg-amber-500 text-black rounded-full text-[10px] font-black animate-pulse shadow-lg shadow-amber-500/20">
                        LIMITED SEATS
                      </div>
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    {isRegisteredForEvent ? "Revision Bootcamp Confirmed" : "Elite Tuition Revision Bootcamp"}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md font-medium">
                    {isRegisteredForEvent 
                      ? "You're all set! Check your schedule for session timings and materials." 
                      : "Join top-performing students for an intensive revision period. Mastering difficult topics with 1-on-1 support."}
                  </p>
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-end gap-3">
                <Button 
                  onClick={() => isRegisteredForEvent ? setActiveTab('results') : null}
                  className={cn(
                    "rounded-2xl px-8 h-12 font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95",
                    isRegisteredForEvent 
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20" 
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                  )}
                >
                  {isRegisteredForEvent ? "VIEW DETAILS" : "REGISTER NOW"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {!isRegisteredForEvent && (
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">
                    <Users className="w-3 h-3 inline mr-1" /> 42 students already joined
                  </p>
                )}
              </div>
            </div>

            {/* 3. Key High-Value Stats Card */}
            <div className="grid grid-cols-1 gap-4">
               <div 
                 onClick={() => setActiveTab('intelligence')}
                 className="relative overflow-hidden bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8 shadow-2xl cursor-pointer group hover:bg-primary/10 transition-all"
               >
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -mr-64 -mt-64" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="flex flex-col items-center justify-center w-32 h-32 rounded-[2rem] bg-primary/20 border border-primary/30 shadow-2xl shrink-0">
                       <Sparkles className="w-10 h-10 text-primary mb-1" />
                       <span className="text-2xl font-black text-primary tracking-tighter">{inference ? `${Math.round(inference.successScore * 100)}` : '...'}</span>
                       <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">Index</span>
                    </div>
                    <div className="space-y-4 text-center md:text-left">
                       <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Success Index Analytics</h3>
                       <p className="text-muted-foreground leading-relaxed max-w-2xl">
                          Your current Success Index is <span className="text-primary font-bold">{Math.round((inference?.successScore || 0.5) * 100)}%</span>. RCCIC predicts a <span className="text-primary font-bold">{inference?.zone || 'Balanced'}</span> academic trajectory. Engagement levels: <span className="text-primary font-bold">Optimal</span>.
                       </p>
                       <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                             <div className="w-2 h-2 rounded-full bg-primary" />
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">GPA: {inference?.successScore ? (inference.successScore * 4).toFixed(2) : '3.6'}</span>
                          </div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Level: Optimal</span>
                          </div>
                       </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* 3. Today’s Schedule Section */}
            {todayClasses.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                   <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                     <Calendar className="w-5 h-5 text-primary" />
                     Today's Schedule
                   </h3>
                   <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{todayDay}, {new Date().toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todayClasses.map((session) => (
                    <div key={session.id} className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 transition-all shadow-sm">
                       <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-muted border border-border/50 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                             <span className="text-sm font-black text-foreground">{session.start_time.split(":")[0]}</span>
                             <span className="text-[9px] font-bold text-muted-foreground uppercase">{session.start_time.split(":")[1]?.includes('00') ? 'AM' : 'PM'}</span>
                          </div>
                          <div>
                             <p className="font-bold text-foreground group-hover:text-primary transition-colors">{session.title}</p>
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{session.subject}</p>
                          </div>
                       </div>
                       <div className="text-[10px] font-mono text-muted-foreground/60">
                          {session.start_time} - {session.end_time}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-muted/30 border border-dashed border-border/60 rounded-[2rem]">
                 <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                 <p className="text-muted-foreground font-medium">No sessions scheduled today.</p>
                 <button onClick={() => setActiveTab('timetable')} className="mt-4 text-xs font-black text-primary uppercase tracking-widest hover:underline">Check upcoming tasks & Schedule</button>
              </div>
            )}

            {/* 4. Upcoming Tasks Section */}
            {pendingAssignments.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                   <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                     <Target className="w-5 h-5 text-emerald-400" />
                     Upcoming Tasks
                   </h3>
                   <Button variant="ghost" size="sm" onClick={() => setActiveTab('assignments')} className="text-xs font-black uppercase tracking-widest text-primary">View All</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pendingAssignments.slice(0, 4).map((assignment) => (
                    <div 
                      key={assignment.id} 
                      onClick={() => setActiveTab("assignments")}
                      className="group flex items-center justify-between p-5 bg-card border border-border/50 rounded-2xl hover:border-emerald-500/30 cursor-pointer shadow-sm transition-all"
                    >
                       <div className="space-y-1.5">
                          <p className="font-bold text-foreground group-hover:text-emerald-400 transition-colors tracking-tight">{assignment.title}</p>
                          <div className="flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full ${new Date(assignment.due_date).getTime() - new Date().getTime() < 86400000 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due {new Date(assignment.due_date).toLocaleDateString()}</p>
                          </div>
                       </div>
                       <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Intelligence Insights Section */}
            {inference && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-2">
                   <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                     <Brain className="w-5 h-5 text-primary" />
                     Academic Insights
                   </h3>
                   <Button variant="ghost" size="sm" onClick={() => setActiveTab('intelligence')} className="text-xs font-black uppercase tracking-widest text-primary">View All Insights</Button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   {inference.insights.slice(0, 1).map((insight, idx) => (
                     <div key={idx} className="relative overflow-hidden bg-card border border-border/40 rounded-[2rem] p-6 shadow-sm group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-100 transition-opacity">
                           <Zap className="w-8 h-8 text-primary" />
                        </div>
                        <div className="flex gap-4">
                           <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Sparkles className="w-5 h-5 text-primary" />
                           </div>
                           <p className="text-base font-medium text-foreground leading-relaxed italic pr-8">
                             "{insight}"
                           </p>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

             {/* 6. Recent Academic Activity Section */}
            <div className="space-y-6">
               <div className="flex items-center gap-2 px-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xl font-bold text-foreground">Recent Academic Activity</h3>
               </div>
               <div className="bg-card border border-border/40 rounded-[2.5rem] divide-y divide-border/30 overflow-hidden shadow-sm">
                  {activitiesList.slice(0, 5).length > 0 ? (
                    activitiesList.slice(0, 5).map((notif) => (
                      <div key={notif.id} className="p-5 flex items-start gap-4 hover:bg-muted/50 transition-colors">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'urgent' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {notif.type === 'urgent' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                         </div>
                         <div className="flex-1">
                            <p className="text-sm font-bold text-foreground">{notif.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono uppercase tracking-widest">{new Date(notif.created_at).toLocaleDateString()}</p>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-muted-foreground italic">
                       No recent academic activities logged.
                    </div>
                  )}
               </div>
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
                          icon: CheckCircle2, 
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
                      ? daySessions.filter(s => {
                          const mySubjects = profile?.subjects || [];
                          if (mySubjects.length === 0 || !s.subject) return true;
                          return mySubjects.some((subject: string) => 
                            subject && s.subject && subject.toLowerCase().trim() === s.subject.toLowerCase().trim()
                          );
                        })
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
                      ? daySessions.filter(s => {
                          const mySubjects = profile?.subjects || [];
                          if (mySubjects.length === 0 || !s.subject) return true;
                          return mySubjects.some((subject: string) => 
                            subject && s.subject && subject.toLowerCase().trim() === s.subject.toLowerCase().trim()
                          );
                        })
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

        {/* Academic Results Intelligence Tab */}
        {activeTab === "intelligence" && profile?.id && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <StudentAcademicIntelligence studentId={profile.id} />
          </div>
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
