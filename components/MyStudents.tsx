"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  GraduationCap,
  Search,
  Users,
  BookOpen,
  School,
  ChevronDown,
  Filter,
  Mail,
  FileText,
  Brain,
  MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TeacherAssignment {
  class_id: string;
  subjects: string[];
  class_name?: string;
  form_level?: string;
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  school_name: string;
  form_class: string;
  subjects: string[];
  avatar_url?: string;
  created_at: string;
}

interface MyStudentsProps {
  teacherId: string;
  onStartChat?: (studentId: string) => void;
}

export default function MyStudents({ teacherId, onStartChat }: MyStudentsProps) {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  useEffect(() => {
    fetchTeacherAssignments();
  }, [teacherId]);

  useEffect(() => {
    filterStudents();
  }, [students, searchQuery, selectedClass, selectedSubject, assignments]);

  async function fetchTeacherAssignments() {
    setLoading(true);

    // Get teacher's class assignments with subjects
    const { data: assignmentsData } = await supabase
      .from("teacher_classes")
      .select(`
        class_id,
        subjects,
        classes (
          name,
          form_level
        )
      `)
      .eq("teacher_id", teacherId);

    if (assignmentsData) {
      const formattedAssignments = assignmentsData.map((a: any) => ({
        class_id: a.class_id,
        subjects: a.subjects || [],
        class_name: a.classes?.name,
        form_level: a.classes?.form_level,
      }));
      setAssignments(formattedAssignments);

      // Now fetch students based on assignments
      await fetchStudentsForAssignments(formattedAssignments);
    }

    setLoading(false);
  }

  async function fetchStudentsForAssignments(teacherAssignments: TeacherAssignment[]) {
    if (teacherAssignments.length === 0) {
      setStudents([]);
      return;
    }

    // Get all form levels the teacher is assigned to
    const formLevels = [...new Set(teacherAssignments.map((a) => a.form_level).filter(Boolean))];
    
    // Get all subjects the teacher teaches
    const teacherSubjects = [...new Set(teacherAssignments.flatMap((a) => a.subjects))];

    if (formLevels.length === 0 || teacherSubjects.length === 0) {
      setStudents([]);
      return;
    }

    // Fetch all students in the teacher's assigned form levels
    const { data: studentsData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .eq("profile_completed", true)
      .in("form_class", formLevels);

    if (studentsData) {
      // Filter students who have at least one subject that the teacher teaches
      // This implements: Student ∈ AssignedClass AND StudentHas(TeacherSubject)
      const eligibleStudents = studentsData.filter((student) => {
        const studentSubjects = student.subjects || [];
        return studentSubjects.some((subject: string) => teacherSubjects.includes(subject));
      });

      setStudents(eligibleStudents);
    }
  }

  function filterStudents() {
    let filtered = [...students];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(query) ||
          s.admission_number?.toLowerCase().includes(query)
      );
    }

    // Class filter
    if (selectedClass !== "all") {
      filtered = filtered.filter((s) => s.form_class === selectedClass);
    }

    // Subject filter
    if (selectedSubject !== "all") {
      filtered = filtered.filter((s) => s.subjects?.includes(selectedSubject));
    }

    setFilteredStudents(filtered);
  }

  // Get unique subjects from teacher's assignments
  const teacherSubjects = [...new Set(assignments.flatMap((a) => a.subjects))];
  
  // Get unique form levels from teacher's assignments
  const formLevels = [...new Set(assignments.map((a) => a.form_level).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-16 bg-card/40 backdrop-blur-xl rounded-2xl border border-border/50">
        <School className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Class Assignments</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          You haven't been assigned to any classes yet. Contact your administrator to get assigned to classes and subjects.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Assignment Summary */}
      <div className="bg-gradient-to-br from-primary/20 to-accent/10 rounded-2xl p-6 border border-primary/20">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Your Teaching Assignments
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment, idx) => (
            <div
              key={idx}
              className="bg-card/50 rounded-xl p-4 border border-border/50"
            >
              <p className="font-medium text-foreground">{assignment.class_name}</p>
              <p className="text-sm text-primary">{assignment.form_level}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {assignment.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or admission number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-input border-border/50"
          />
        </div>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-full sm:w-40 bg-input border-border/50">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {formLevels.map((form) => (
              <SelectItem key={form} value={form || ""}>
                {form}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-full sm:w-48 bg-input border-border/50">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {teacherSubjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students Count */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          <span className="text-foreground font-semibold">{filteredStudents.length}</span> students
          {selectedClass !== "all" && ` in ${selectedClass}`}
          {selectedSubject !== "all" && ` taking ${selectedSubject}`}
        </p>
      </div>

      {/* Students Grid */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 bg-card/40 backdrop-blur-xl rounded-2xl border border-border/50">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {students.length === 0
              ? "No students enrolled in your classes with your subjects yet"
              : "No students match your search criteria"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              className="bg-card/40 backdrop-blur-xl rounded-2xl p-5 border border-border/50 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center flex-shrink-0">
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url || "/placeholder.svg"}
                      alt={student.full_name}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    <GraduationCap className="w-6 h-6 text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground truncate">{student.full_name}</h4>
                  <p className="text-sm text-primary font-mono">{student.admission_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">{student.form_class}</p>
                </div>
              </div>

              {/* Shared Subjects */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Subjects (shared with you)</p>
                <div className="flex flex-wrap gap-1">
                  {student.subjects
                    ?.filter((s) => teacherSubjects.includes(s))
                    .map((subject) => (
                      <span
                        key={subject}
                        className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded"
                      >
                        {subject}
                      </span>
                    ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Notes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-accent hover:text-accent hover:bg-accent/10"
                >
                  <Brain className="w-4 h-4 mr-1" />
                  Quiz
                </Button>
                {onStartChat && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onStartChat(student.id)}
                    className="flex-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Chat
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
