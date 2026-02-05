"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  ShieldCheck,
  Users,
  GraduationCap,
  School,
  Plus,
  Trash2,
  Edit2,
  UserPlus,
  LogOut,
  BarChart3,
  Bell,
  Search,
  ChevronDown,
  X,
  Check,
  BookOpen,
  Sparkles,
  Calendar,
  DollarSign,
  FileText,
  Trophy,
} from "lucide-react";
import EventManager from "@/components/EventManager";
import TuitionManager from "@/components/TuitionManager";
import NotificationCreator from "@/components/admin/NotificationCreator";
import AdminTimetableTab from "@/components/admin/AdminTimetableTab";
import AdminExamManager from "@/components/admin/AdminExamManager";
import AdminTranscriptManager from "@/components/admin/AdminTranscriptManager";
import { DashboardTabNavigation } from "@/components/DashboardTabNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import MessagingCenter from "@/components/MessagingCenter";
import { MessageSquare } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  subject?: string;
  created_at: string;
}

interface Class {
  id: string;
  name: string;
  form_level: string;
  year: number;
  created_at: string;
}

interface TeacherClass {
  id: string;
  teacher_id: string;
  class_id: string;
  subjects: string[];
  assigned_at: string;
  teacher?: Teacher;
  class?: Class;
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  school_name: string;
  form_class: string;
  subjects: string[];
  created_at: string;
}

const EDUCATION_SYSTEMS = ["8-4-4", "CBC"];
const FORM_LEVELS_844 = ["Form 1", "Form 2", "Form 3", "Form 4"];
const FORM_LEVELS_CBC = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7 (JSS)", "Grade 8 (JSS)", "Grade 9 (JSS)"
];
const SUBJECTS = [
  "Mathematics", "English", "Kiswahili", "Physics", "Chemistry", "Biology",
  "History", "Geography", "Computer Studies", "Business Studies", "Agriculture", "Religious Education"
];

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "teachers" | "classes" | "students" | "assignments" | "timetables" | "events" | "finance" | "messages" | "notifications" | "exams" | "transcripts">("overview");
  const [adminId, setAdminId] = useState<string>("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showClassModal, setShowClassModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // Form states
  const [className, setClassName] = useState("");
  const [educationSystem, setEducationSystem] = useState("8-4-4");
  const [formLevel, setFormLevel] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    // Auth is handled by layout.tsx - just fetch data
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAdminId(session.user.id);
        fetchData();
      }
      setLoading(false);
    }
    
    init();
  }, []);

  async function fetchData() {
    // Fetch teachers
    const { data: teachersData } = await supabase
      .from("profiles")
      .select("id, full_name, subject, created_at")
      .eq("role", "teacher")
      .order("created_at", { ascending: false });

    // Get emails from auth - we'll use id as fallback
    if (teachersData) {
      const teachersWithEmails = teachersData.map(t => ({
        ...t,
        email: `teacher-${t.id.slice(0, 8)}@eduflow.app`
      }));
      setTeachers(teachersWithEmails);
    }

    // Fetch classes
    const { data: classesData } = await supabase
      .from("classes")
      .select("*")
      .order("form_level", { ascending: true });
    if (classesData) setClasses(classesData);

    // Fetch students
    const { data: studentsData } = await supabase
      .from("profiles")
      .select("id, full_name, admission_number, school_name, form_class, subjects, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });
    if (studentsData) setStudents(studentsData);

    // Fetch teacher-class assignments
    const { data: assignmentsData } = await supabase
      .from("teacher_classes")
      .select("*")
      .order("assigned_at", { ascending: false });
    if (assignmentsData) setTeacherClasses(assignmentsData);
  }

  async function handleCreateClass() {
    if (!className || !formLevel) return;

    const { error } = await supabase
      .from("classes")
      .insert({
        name: className,
        form_level: educationSystem === "CBC" ? `${formLevel} (CBC)` : formLevel,
        education_system: educationSystem,
        year: new Date().getFullYear(),
      });

    if (!error) {
      setShowClassModal(false);
      setClassName("");
      setFormLevel("");
      fetchData();
    }
  }

  async function handleDeleteClass(id: string) {
    await supabase.from("classes").delete().eq("id", id);
    fetchData();
  }

  async function handleAssignTeacher() {
    if (!selectedTeacher || !selectedClass || selectedSubjects.length === 0) return;

    const { error } = await supabase
      .from("teacher_classes")
      .upsert({
        teacher_id: selectedTeacher,
        class_id: selectedClass,
        subjects: selectedSubjects,
      }, {
        onConflict: "teacher_id,class_id"
      });

    if (!error) {
      setShowAssignModal(false);
      setSelectedTeacher("");
      setSelectedClass("");
      setSelectedSubjects([]);
      fetchData();
    }
  }

  async function handleRemoveAssignment(id: string) {
    await supabase.from("teacher_classes").delete().eq("id", id);
    fetchData();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleDeleteUser(userId: string, type: 'teacher' | 'student') {
    if (!confirm(`Are you sure you want to delete this ${type}? This will remove their profile and all associated data.`)) return;

    try {
      // Delete from profiles - RLS must allow admins to delete
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      
      if (error) throw error;
      
      // Also try to delete from teacher_classes if teacher
      if (type === 'teacher') {
        await supabase.from("teacher_classes").delete().eq("teacher_id", userId);
      }

      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user. You may not have permission or there are dependencies.");
    }
  }

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Create New Class</h2>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Class Name</Label>
                <Input
                  placeholder="e.g., Form 2 East"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="h-11 bg-muted border-border/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Education System</Label>
                <Select value={educationSystem} onValueChange={(val) => {
                  setEducationSystem(val);
                  setFormLevel(""); // Reset form level when system changes
                }}>
                  <SelectTrigger className="h-11 bg-muted border-border/50">
                    <SelectValue placeholder="Select system" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_SYSTEMS.map(sys => (
                      <SelectItem key={sys} value={sys}>{sys}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Class/Grade Level</Label>
                <Select value={formLevel} onValueChange={setFormLevel}>
                  <SelectTrigger className="h-11 bg-muted border-border/50">
                    <SelectValue placeholder={`Select ${educationSystem === "CBC" ? "grade" : "form"} level`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(educationSystem === "CBC" ? FORM_LEVELS_CBC : FORM_LEVELS_844).map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleCreateClass} className="w-full h-11 bg-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Class
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Teacher Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Assign Teacher to Class</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="h-11 bg-muted border-border/50">
                    <SelectValue placeholder="Choose a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(teacher => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-11 bg-muted border-border/50">
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} ({cls.form_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Teaching Subjects</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/50 rounded-lg">
                  {SUBJECTS.map(subject => (
                    <div
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        selectedSubjects.includes(subject)
                          ? "bg-primary/20 border border-primary/50"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Checkbox checked={selectedSubjects.includes(subject)} />
                      <span className="text-sm text-foreground">{subject}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleAssignTeacher} 
                className="w-full h-11 bg-accent hover:bg-accent/90"
                disabled={!selectedTeacher || !selectedClass || selectedSubjects.length === 0}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Teacher
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header - Visible only on small screens */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 lg:hidden">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-foreground">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">EduFlow</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Header - Hidden on mobile */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">EduFlow Management</p>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search teachers, students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted border-border/50"
                />
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 pb-24 lg:pb-8">
        {/* Responsive Tab Navigation */}
        <DashboardTabNavigation
          tabs={[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "teachers", label: "Teachers", icon: Users },
            { id: "classes", label: "Classes", icon: School },
            { id: "students", label: "Students", icon: GraduationCap },
            { id: "exams", label: "Exams", icon: FileText },
            { id: "transcripts", label: "Transcripts", icon: Trophy },
            { id: "assignments", label: "Assignments", icon: BookOpen },
            { id: "timetables", label: "Timetables", icon: Calendar },
            { id: "events", label: "Events", icon: Sparkles },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "finance", label: "Finance", icon: DollarSign },
            { id: "messages", label: "Messages", icon: MessageSquare },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
        />

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-accent" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{teachers.length}</p>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-chart-3/20 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-chart-3" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{students.length}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <School className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{classes.length}</p>
                <p className="text-sm text-muted-foreground">Active Classes</p>
              </div>

              <div className="bg-card border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-destructive/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-destructive" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{teacherClasses.length}</p>
                <p className="text-sm text-muted-foreground">Assignments</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border/50 rounded-xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  onClick={() => setShowClassModal(true)}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 border-border/50 bg-transparent"
                >
                  <Plus className="w-5 h-5" />
                  <span>Create Class</span>
                </Button>
                <Button
                  onClick={() => setShowAssignModal(true)}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 border-border/50 bg-transparent"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Assign Teacher</span>
                </Button>
                <Button
                  onClick={() => setActiveTab("teachers")}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 border-border/50 bg-transparent"
                >
                  <Users className="w-5 h-5" />
                  <span>View Teachers</span>
                </Button>
                <Button
                  onClick={() => setActiveTab("students")}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 border-border/50 bg-transparent"
                >
                  <GraduationCap className="w-5 h-5" />
                  <span>View Students</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === "teachers" && (
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Teachers ({filteredTeachers.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Joined</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTeachers.map(teacher => (
                    <tr key={teacher.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{teacher.full_name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{teacher.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{teacher.subject || "Not set"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(teacher.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedTeacher(teacher.id);
                              setShowAssignModal(true);
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteUser(teacher.id, 'teacher')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowClassModal(true)} className="bg-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Class
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classes.map(cls => (
                <div key={cls.id} className="bg-card border border-border/50 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{cls.name}</h3>
                      <p className="text-sm text-muted-foreground">{cls.form_level}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClass(cls.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Year: {cls.year}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === "students" && (
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold text-foreground">Students ({filteredStudents.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Admission No.</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Class</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">School</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Subjects</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{student.full_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-chart-3">{student.admission_number}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{student.form_class}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{student.school_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(student.subjects || []).slice(0, 3).map(subject => (
                            <span key={subject} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                              {subject}
                            </span>
                          ))}
                          {(student.subjects || []).length > 3 && (
                            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded">
                              +{student.subjects.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUser(student.id, 'student')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowAssignModal(true)} className="bg-accent hover:bg-accent/90">
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Teacher
              </Button>
            </div>

            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <h3 className="font-semibold text-foreground">Teacher-Class Assignments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Teacher</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Class</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Subjects</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Assigned</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {teacherClasses.map(tc => {
                      const teacher = teachers.find(t => t.id === tc.teacher_id);
                      const cls = classes.find(c => c.id === tc.class_id);
                      return (
                        <tr key={tc.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {teacher?.full_name || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {cls ? `${cls.name} (${cls.form_level})` : "Unknown"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(tc.subjects || []).map(subject => (
                                <span key={subject} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                                  {subject}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(tc.assigned_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveAssignment(tc.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Timetables Tab */}
        {activeTab === "timetables" && (
          <AdminTimetableTab />
        )}

        {/* Events Tab */}
        {activeTab === "events" && adminId && (
          <EventManager userRole="admin" userId={adminId} />
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && adminId && (
          <NotificationCreator adminId={adminId} />
        )}

        {/* Finance Tab */}
        {activeTab === "finance" && adminId && (
          <TuitionManager userRole="admin" userId={adminId} />
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && adminId && (
          <div className="bg-white rounded-2xl shadow-sm border border-border/50 p-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">Messaging Center</h2>
            <MessagingCenter
              userId={adminId}
              userRole="admin"
              userName="Admin"
            />
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === "exams" && (
          <AdminExamManager />
        )}

        {/* Transcripts Tab */}
        {activeTab === "transcripts" && (
          <AdminTranscriptManager />
        )}
      </div>
    </div>
  );
}
