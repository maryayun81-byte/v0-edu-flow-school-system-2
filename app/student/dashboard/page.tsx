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
  CreditCard,
  Search,
  ChevronRight,
  TrendingUp,
  Target,
  Zap,
  Sparkles,
  Settings,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudentProfileModal from "@/components/StudentProfileModal";
import StudentIDCard from "@/components/StudentIDCard";
import QuizPlayer from "@/components/QuizPlayer";
import Leaderboard from "@/components/Leaderboard";
import { MobileNavigation } from "@/components/MobileNavigation";
import EventManager from "@/components/EventManager";
import TuitionManager from "@/components/TuitionManager";
import StudentSettings from "@/components/StudentSettings";
import MessagingCenter from "@/components/MessagingCenter";
import { StudentDashboardSkeleton } from "@/components/DashboardSkeleton";

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "assignments" | "timetable" | "quizzes" | "leaderboard" | "id-card" | "events" | "payments" | "settings" | "messages">("overview");
  const [notes, setNotes] = useState<Note[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push("/student/login");
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

    // Fetch content
    await fetchContent();
    setLoading(false);
  }

  async function fetchContent() {
    const [notesRes, assignmentsRes, timetableRes, quizzesRes] = await Promise.all([
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("assignments").select("*").eq("is_archived", false).order("due_date", { ascending: true }),
      supabase.from("timetables").select("*").order("start_time", { ascending: true }),
      supabase.from("quizzes").select("*").eq("is_published", true).order("created_at", { ascending: false }),
    ]);

    if (notesRes.data) setNotes(notesRes.data);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data);
    if (timetableRes.data) setTimetable(timetableRes.data);
    
    if (quizzesRes.data) {
      const quizzesWithCount = await Promise.all(
        quizzesRes.data.map(async (quiz) => {
          const { count } = await supabase
            .from("quiz_questions")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id);
          return { ...quiz, question_count: count || 0 };
        })
      );
      setQuizzes(quizzesWithCount);
    }
  }

  function handleProfileComplete() {
    setShowProfileModal(false);
    checkAuth();
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
  const todayClasses = timetable.filter((t) => t.day_of_week === todayDay);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: "overview", label: "Overview", icon: TrendingUp },
{ id: "notes", label: "Notes", icon: FileText },
  { id: "assignments", label: "Tasks", icon: Target },
  { id: "timetable", label: "Schedule", icon: Calendar },
  { id: "quizzes", label: "Quizzes", icon: Brain },
  { id: "leaderboard", label: "Rankings", icon: Trophy },
{ id: "messages", label: "Messages", icon: MessageSquare },
            { id: "events", label: "Events", icon: Calendar },
            { id: "payments", label: "Fees", icon: CreditCard },
            { id: "id-card", label: "ID Card", icon: CreditCard },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        {/* Timetable Tab */}
        {activeTab === "timetable" && (
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Day
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Class
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {timetable.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {entry.day_of_week}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                        {entry.start_time} - {entry.end_time}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.subject}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        {/* Settings Tab */}
        {activeTab === "settings" && profile && (
          <StudentSettings
            profile={profile}
            onProfileUpdate={checkAuth}
          />
        )}
      </div>

      {/* Mobile Navigation */}
      <MobileNavigation role="student" unreadNotifications={notifications.length} />
    </div>
  );
}
