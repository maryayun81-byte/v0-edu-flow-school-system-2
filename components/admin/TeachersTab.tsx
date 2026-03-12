"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Users, UserPlus, BookOpen, Layers,
  ChevronLeft, ChevronRight, Edit2, Trash2, Shield, MoreHorizontal, MoreVertical, LayoutGrid, Check, X,
  GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const supabase = createClient();

interface TeacherProfile {
  id: string;
  full_name: string;
  subject?: string;
  created_at: string;
  email: string;
  teacher_classes: {
    class_id: string;
    subjects: string[];
    classes: {
      name: string;
    };
  }[];
  class_teachers: {
    class: {
      name: string;
    };
  }[];
  is_class_teacher: boolean;
  assigned_classes_count: number;
  total_subjects_count: number;
}

const ITEMS_PER_PAGE = 8;
const SUBJECTS = [
  "Mathematics", "English", "Kiswahili", "Physics", "Chemistry", "Biology",
  "History", "Geography", "Computer Studies", "Business Studies", "Agriculture", "Religious Education"
];

export default function TeachersTab() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [classesList, setClassesList] = useState<{id: string, name: string, form_level: string}[]>([]);

  // Assignment Modal States
  const [assignmentCurriculum, setAssignmentCurriculum] = useState<string>("8-4-4");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all"); // all, class_teacher, subject_teacher, unassigned
  const [loadFilter, setLoadFilter] = useState("all"); // all, light, medium, heavy
  
  // Selection / Bulk actions
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  
  // Insights logic
  const [insights, setInsights] = useState({
    total: 0,
    classTeachers: 0,
    subjectTeachers: 0,
    unassigned: 0
  });

  // Modal logic
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTeacherForActions, setSelectedTeacherForActions] = useState<TeacherProfile | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [currentPage, subjectFilter, classFilter, roleFilter, loadFilter, searchQuery]);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('id, name, form_level').order('form_level', { ascending: true });
    if (data) setClassesList(data);
  }

  async function fetchTeachers() {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, full_name, subject, created_at, email', { count: 'exact' })
      .eq('role', 'teacher');

    if (searchQuery) {
      query = query.ilike('full_name', `%${searchQuery}%`);
    }
    if (subjectFilter !== 'all') {
      query = query.eq('subject', subjectFilter);
    }

    // Pagination
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data: profiles, count, error } = await query;
    if (error) {
      toast.error("Failed to load teachers");
      setLoading(false);
      return;
    }

    if (profiles && profiles.length > 0) {
      const profileIds = profiles.map((p: any) => p.id);
      
      const [ { data: tClasses }, { data: cTeachers } ] = await Promise.all([
          supabase.from('teacher_classes').select('teacher_id, class_id, subjects, classes(name)').in('teacher_id', profileIds),
          supabase.from('class_teachers').select('teacher_id, classes(name)').in('teacher_id', profileIds)
      ]);

      let formatted: TeacherProfile[] = profiles.map((p: any) => {
        const myTClasses = tClasses?.filter((tc: any) => tc.teacher_id === p.id) || [];
        const myCTeachers = cTeachers?.filter((ct: any) => ct.teacher_id === p.id) || [];
        
        const isClassTeacher = myCTeachers.length > 0;
        const classesAssigned = myTClasses.length;
        const totalSubjects = myTClasses.reduce((acc: number, tc: any) => acc + (tc.subjects?.length || 0), 0);
        
        return {
          ...p,
          email: p.email || `teacher-${p.id.slice(0, 8)}@eduflow.app`,
          teacher_classes: myTClasses,
          class_teachers: myCTeachers,
          is_class_teacher: isClassTeacher,
          assigned_classes_count: classesAssigned,
          total_subjects_count: totalSubjects
        };
      });

      // Apply client-side filters for role & class assignment since they are nested
      if (roleFilter !== 'all') {
        if (roleFilter === 'class_teacher') formatted = formatted.filter(t => t.is_class_teacher);
        if (roleFilter === 'subject_teacher') formatted = formatted.filter(t => t.assigned_classes_count > 0 && !t.is_class_teacher);
        if (roleFilter === 'unassigned') formatted = formatted.filter(t => t.assigned_classes_count === 0 && !t.is_class_teacher);
      }
      
      if (classFilter !== 'all') {
        formatted = formatted.filter(t => t.teacher_classes?.some(tc => tc.class_id === classFilter));
      }

      if (loadFilter !== 'all') {
        if (loadFilter === 'light') formatted = formatted.filter(t => t.assigned_classes_count >= 0 && t.assigned_classes_count <= 2);
        if (loadFilter === 'medium') formatted = formatted.filter(t => t.assigned_classes_count >= 3 && t.assigned_classes_count <= 4);
        if (loadFilter === 'heavy') formatted = formatted.filter(t => t.assigned_classes_count >= 5);
      }

      setTeachers(formatted);
      setTotalCount(count || formatted.length); 
      calculateInsights(formatted);
    } else {
      setTeachers([]);
      setTotalCount(0);
      setInsights({total: 0, classTeachers: 0, subjectTeachers: 0, unassigned: 0});
    }
    setLoading(false);
  }

  function calculateInsights(data: TeacherProfile[]) {
    let ct = 0, st = 0, un = 0;
    data.forEach(t => {
      if (t.is_class_teacher) ct++;
      else if (t.assigned_classes_count > 0) st++;
      else un++;
    });
    setInsights({
      total: data.length, // page total
      classTeachers: ct,
      subjectTeachers: st,
      unassigned: un
    });
  }

  async function handleAssignTeacher() {
    if (!selectedTeacherForActions || !selectedClass || selectedSubjects.length === 0) return;

    const { error } = await supabase
      .from("teacher_classes")
      .upsert({
        teacher_id: selectedTeacherForActions.id,
        class_id: selectedClass,
        subjects: selectedSubjects,
      }, {
        onConflict: "teacher_id,class_id"
      });

    if (!error) {
      toast.success("Teacher successfully assigned");
      setShowAssignModal(false);
      setSelectedClass("");
      setSelectedSubjects([]);
      fetchTeachers();
    } else {
      toast.error("Failed to assign teacher: " + error.message);
    }
  }

  function toggleSubject(subject: string) {
    setSelectedSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  }

  function handleSelectAll() {
    if (selectedTeachers.length === teachers.length) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers(teachers.map(t => t.id));
    }
  }

  function toggleTeacherSelection(id: string) {
    if (selectedTeachers.includes(id)) {
      setSelectedTeachers(selectedTeachers.filter(tId => tId !== id));
    } else {
      setSelectedTeachers([...selectedTeachers, id]);
    }
  }

  async function handleDeleteTeacher(id: string) {
    if (!confirm("Remove this teacher? This cannot be undone.")) return;
    try {
      await supabase.from("profiles").delete().eq("id", id);
      toast.success("Teacher removed");
      fetchTeachers();
    } catch (e: any) {
      toast.error("Failed to remove: " + e.message);
    }
  }

  async function handleBulkAssign() {
    if (!selectedClass || selectedSubjects.length === 0 || selectedTeachers.length === 0) return;

    const inserts = selectedTeachers.map(id => ({
      teacher_id: id,
      class_id: selectedClass,
      subjects: selectedSubjects,
    }));

    const { error } = await supabase.from("teacher_classes").upsert(inserts, { onConflict: "teacher_id,class_id" });
    if (!error) {
       toast.success("Teachers successfully assigned");
       setShowBulkAssignModal(false);
       setSelectedClass("");
       setSelectedSubjects([]);
       setSelectedTeachers([]);
       fetchTeachers();
    } else {
       toast.error("Failed to assign teachers");
    }
  }

  async function handleBulkRemove() {
    if (!confirm(`Remove ${selectedTeachers.length} selected teachers? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from("profiles").delete().in("id", selectedTeachers);
      if (error) throw error;
      toast.success("Teachers removed");
      setSelectedTeachers([]);
      fetchTeachers();
    } catch (e: any) {
      toast.error("Failed to remove: " + e.message);
    }
  }

  const Pagination = () => {
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-8 bg-card/50 p-4 rounded-2xl border border-border/50">
        <span className="text-sm font-medium text-muted-foreground">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} teachers
        </span>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="rounded-xl border-border/50"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <div className="flex items-center gap-1 mx-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                  currentPage === i + 1 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="rounded-xl border-border/50"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Filter & Insights Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Insights Panel */}
        <div className="lg:w-1/3 bg-gradient-to-br from-card to-card/50 border border-border/50 rounded-3xl p-6 shadow-xl shadow-black/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users className="w-24 h-24 text-primary" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Workforce Overview</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-3xl font-black text-foreground">{insights.total}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Displayed</p>
                </div>
                <div>
                    <p className="text-3xl font-black text-indigo-500">{insights.classTeachers}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Class Teachers</p>
                </div>
                <div>
                    <p className="text-3xl font-black text-green-500">{insights.subjectTeachers}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Subject Teachers</p>
                </div>
                <div>
                    <p className="text-3xl font-black text-amber-500">{insights.unassigned}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Unassigned</p>
                </div>
            </div>
        </div>

        {/* Filter Panel */}
        <div className="lg:w-2/3 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search teachers by name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-background/50 border-border/50 rounded-xl"
                    />
                </div>
                {selectedTeachers.length > 0 && (
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 animate-in slide-in-from-right-4">
                        <span className="text-sm font-bold text-primary">{selectedTeachers.length} selected</span>
                        <div className="w-px h-4 bg-primary/20 mx-2" />
                        <Button size="sm" variant="ghost" onClick={() => setShowBulkAssignModal(true)} className="h-7 text-xs font-bold text-primary hover:bg-primary/20">Assign</Button>
                        <Button size="sm" variant="ghost" onClick={handleBulkRemove} className="h-7 text-xs font-bold text-destructive hover:bg-destructive/20">Remove</Button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject</label>
                    <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                        <SelectTrigger className="h-10 bg-background/50 border-border/50 rounded-xl">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Subjects</SelectItem>
                            {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Class</label>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger className="h-10 bg-background/50 border-border/50 rounded-xl">
                            <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {classesList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Role</label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="h-10 bg-background/50 border-border/50 rounded-xl">
                            <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="class_teacher">Class Teachers</SelectItem>
                            <SelectItem value="subject_teacher">Subject Teachers</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Load</label>
                    <Select value={loadFilter} onValueChange={setLoadFilter}>
                        <SelectTrigger className="h-10 bg-background/50 border-border/50 rounded-xl">
                            <SelectValue placeholder="All Loads" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Loads</SelectItem>
                            <SelectItem value="light">Light Load</SelectItem>
                            <SelectItem value="medium">Medium Load</SelectItem>
                            <SelectItem value="heavy">Heavy Load</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

      </div>

      {/* 2. Teacher Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
                <Checkbox 
                    checked={teachers.length > 0 && selectedTeachers.length === teachers.length}
                    onCheckedChange={handleSelectAll}
                    id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-bold text-muted-foreground cursor-pointer">
                    Select All on Page
                </label>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <LayoutGrid className="w-4 h-4" />
                <span>Grid View</span>
            </div>
        </div>

        {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-[280px] rounded-[2rem] bg-card border border-border/50 animate-pulse" />
                ))}
             </div>
        ) : teachers.length === 0 ? (
             <div className="text-center py-24 bg-card/30 border border-border/50 rounded-[2rem] border-dashed">
                 <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                     <Users className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-bold text-foreground">No teachers found</h3>
                 <p className="text-sm text-muted-foreground mt-1 mb-6">Try adjusting your filters or search query.</p>
                 <Button onClick={() => {
                     setSearchQuery("");
                     setSubjectFilter("all");
                     setClassFilter("all");
                     setRoleFilter("all");
                     setLoadFilter("all");
                 }} variant="outline" className="rounded-xl">
                     Reset Filters
                 </Button>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {teachers.map(teacher => (
                    <div 
                        key={teacher.id} 
                        className={`group bg-card transition-all duration-300 border rounded-[2rem] overflow-hidden hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 relative ${
                            selectedTeachers.includes(teacher.id) ? 'border-primary ring-1 ring-primary/20 bg-primary/[0.02]' : 'border-border/50'
                        }`}
                    >
                        <div className="absolute top-4 left-4 z-10">
                            <Checkbox 
                                checked={selectedTeachers.includes(teacher.id)}
                                onCheckedChange={() => toggleTeacherSelection(teacher.id)}
                                className={`transition-opacity ${selectedTeachers.includes(teacher.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            />
                        </div>

                        <div className="absolute top-4 right-4 z-10">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/50 backdrop-blur-md border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                                    <DropdownMenuItem onClick={() => { setSelectedTeacherForActions(teacher); setShowDetailsModal(true); }}>
                                        <Layers className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { 
                                        setSelectedTeacherForActions(teacher);
                                        setSelectedSubjects(teacher.subject ? [teacher.subject] : []);
                                        setShowAssignModal(true); 
                                    }}>
                                        <UserPlus className="w-4 h-4 mr-2" /> Assign Class
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteTeacher(teacher.id)}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Remove Teacher
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="p-6 text-center border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                            <div className="w-20 h-20 bg-gradient-to-tr from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                                <span className="text-2xl font-black text-primary">
                                    {teacher.full_name?.[0]?.toUpperCase() || "T"}
                                </span>
                            </div>
                            <h3 className="font-bold text-foreground text-lg tracking-tight truncate px-4">{teacher.full_name || "Unnamed Teacher"}</h3>
                            <p className="text-xs text-muted-foreground mt-1 truncate px-4">{teacher.email}</p>
                            
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                                {teacher.is_class_teacher && (
                                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[9px] uppercase font-black px-2 py-0.5">
                                        Class Teacher
                                    </Badge>
                                )}
                                {teacher.assigned_classes_count > 0 && !teacher.is_class_teacher && (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[9px] uppercase font-black px-2 py-0.5">
                                        Subject Teacher
                                    </Badge>
                                )}
                                {teacher.assigned_classes_count === 0 && !teacher.is_class_teacher && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] uppercase font-black px-2 py-0.5">
                                        Unassigned
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-card">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 gap-1.5">
                                        <BookOpen className="w-3.5 h-3.5" /> Subjects
                                    </div>
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {teacher.subject || "Not specified"}
                                    </p>
                                </div>
                                <div>
                                    <div className="flex items-center text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5" /> Classes Assigned
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {teacher.teacher_classes?.slice(0, 3).map((tc, idx) => (
                                            <span key={idx} className="text-xs bg-muted px-2 py-1 rounded-md font-medium text-muted-foreground border border-border/50">
                                                {tc.classes?.name}
                                            </span>
                                        ))}
                                        {(teacher.teacher_classes?.length || 0) > 3 && (
                                            <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                                                +{teacher.teacher_classes.length - 3} more
                                            </span>
                                        )}
                                        {teacher.teacher_classes?.length === 0 && (
                                            <span className="text-xs text-muted-foreground italic">No classes yet</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-6">
                                <Button 
                                    onClick={() => { 
                                        setSelectedTeacherForActions(teacher); 
                                        setSelectedSubjects(teacher.subject ? [teacher.subject] : []);
                                        setShowAssignModal(true); 
                                    }}
                                    variant="outline" 
                                    className="w-full text-xs font-bold rounded-xl border-primary/20 text-primary hover:bg-primary/10"
                                >
                                    Assign
                                </Button>
                                <Button 
                                    onClick={() => { setSelectedTeacherForActions(teacher); setShowDetailsModal(true); }}
                                    variant="secondary" 
                                    className="w-full text-xs font-bold rounded-xl"
                                >
                                    Details
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <Pagination />

        {/* 3. Details Modal */}
        {showDetailsModal && selectedTeacherForActions && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border/50 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="relative h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent">
                        <button onClick={() => setShowDetailsModal(false)} className="absolute top-6 right-6 p-2 bg-background/50 hover:bg-background/80 backdrop-blur-md rounded-full transition-colors z-10">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="px-8 pb-8 -mt-16 relative z-10">
                        <div className="flex items-end gap-6 mb-8">
                            <div className="w-32 h-32 rounded-3xl bg-card border-4 border-background flex items-center justify-center shadow-xl overflow-hidden bg-gradient-to-br from-muted to-muted/50">
                                <span className="text-5xl font-black text-primary/50">{selectedTeacherForActions.full_name[0]}</span>
                            </div>
                            <div className="pb-2">
                                <h2 className="text-3xl font-black text-foreground tracking-tight">{selectedTeacherForActions.full_name}</h2>
                                <p className="text-muted-foreground font-medium">{selectedTeacherForActions.email}</p>
                                <div className="flex gap-2 mt-3">
                                    <Badge variant="secondary" className="rounded-lg">{selectedTeacherForActions.subject || "No Subject"}</Badge>
                                    <Badge variant="outline" className="rounded-lg border-primary/30 text-primary">ID: {selectedTeacherForActions.id.slice(0,8)}</Badge>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" /> Teaching Roles
                                    </h4>
                                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Class Teacher</span>
                                            {selectedTeacherForActions.is_class_teacher ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-muted-foreground" />}
                                        </div>
                                        {selectedTeacherForActions.class_teachers?.map((ct: any, i: number) => (
                                            <div key={i} className="text-xs text-muted-foreground pl-4 border-l-2 border-indigo-500/30">
                                                Form Class: <strong>{ct.classes?.name}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                                        <Layers className="w-4 h-4" /> Assigned Classes
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedTeacherForActions.teacher_classes?.map((tc, idx) => (
                                            <div key={idx} className="bg-background border border-border/50 rounded-xl p-3 flex justify-between items-center text-sm shadow-sm group hover:border-primary/30 transition-colors">
                                                <span className="font-bold">{tc.classes?.name}</span>
                                                <div className="flex gap-1">
                                                    {tc.subjects?.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                                                </div>
                                            </div>
                                        ))}
                                        {!selectedTeacherForActions.teacher_classes?.length && (
                                            <p className="text-sm text-muted-foreground italic">No classes assigned yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                                        <Shield className="w-4 h-4" /> Register Performance
                                    </h4>
                                    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-foreground">Registers Marked</span>
                                            <span className="text-sm font-black text-green-500">92%</span>
                                        </div>
                                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
                                            <div className="h-full bg-green-500 w-[92%]" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Missed</p>
                                                <p className="text-lg font-black text-red-500">3</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Completed</p>
                                                <p className="text-lg font-black text-green-500">41</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Workload Summary
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex flex-col items-center justify-center text-center">
                                            <span className="text-2xl font-black text-foreground">{selectedTeacherForActions.assigned_classes_count}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Classes</span>
                                        </div>
                                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex flex-col items-center justify-center text-center">
                                            <span className="text-2xl font-black text-foreground">{selectedTeacherForActions.total_subjects_count}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Subjects</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        )}

        {/* 4. Assign Class Modal */}
        {showAssignModal && selectedTeacherForActions && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Assign Class</h2>
                            <p className="text-sm text-muted-foreground mt-1">For <span className="font-bold text-foreground">{selectedTeacherForActions.full_name}</span></p>
                        </div>
                        <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Curriculum</label>
                                <Select value={assignmentCurriculum} onValueChange={(val) => {
                                    setAssignmentCurriculum(val);
                                    setSelectedClass("");
                                }}>
                                    <SelectTrigger className="h-11 bg-muted/50 border-border/50 rounded-xl">
                                        <SelectValue placeholder="Select Curriculum" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="8-4-4">8-4-4 (Forms)</SelectItem>
                                        <SelectItem value="CBC">CBC (Grades)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Class</label>
                                <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!assignmentCurriculum}>
                                    <SelectTrigger className="h-11 bg-muted/50 border-border/50 rounded-xl">
                                        <SelectValue placeholder="Choose a class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classesList
                                            .filter(c => {
                                                const name = c.name.toLowerCase();
                                                if (assignmentCurriculum === 'CBC') return name.startsWith('grade');
                                                if (assignmentCurriculum === '8-4-4') return name.startsWith('form');
                                                return true;
                                            })
                                            .map(cls => (
                                                <SelectItem key={cls.id} value={cls.id}>
                                                    {cls.name} ({cls.form_level})
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Teaching Subjects</label>
                                <p className="text-[10px] text-muted-foreground mt-1">Select one or more subjects</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/20 rounded-xl border border-border/50">
                                {SUBJECTS.map(subject => {
                                    const isLegacyPreferred = selectedTeacherForActions?.subject === subject;
                                    const isSelected = selectedSubjects.includes(subject);
                                    return (
                                        <div
                                            key={subject}
                                            onClick={() => toggleSubject(subject)}
                                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                                isSelected 
                                                    ? "bg-primary/20 border-primary/50 text-foreground" 
                                                    : isLegacyPreferred 
                                                        ? "bg-green-500/10 border-green-500/30 text-foreground" 
                                                        : "hover:bg-muted border-transparent text-muted-foreground"
                                            } border`}
                                        >
                                            <Checkbox checked={isSelected} />
                                            <div className="flex flex-col">
                                                <span className="text-sm">{subject}</span>
                                                {isLegacyPreferred && <span className="text-[9px] text-green-500 font-bold uppercase">Main</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Button 
                            onClick={handleAssignTeacher} 
                            disabled={!selectedClass || selectedSubjects.length === 0}
                            className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg shadow-primary/20"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Confirm Assignment
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* 5. Bulk Assign Modal */}
        {showBulkAssignModal && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Bulk Assign Class</h2>
                            <p className="text-sm text-muted-foreground mt-1">Assigning <span className="font-bold text-primary">{selectedTeachers.length}</span> teachers</p>
                        </div>
                        <button onClick={() => setShowBulkAssignModal(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Curriculum</label>
                                <Select value={assignmentCurriculum} onValueChange={(val) => {
                                    setAssignmentCurriculum(val);
                                    setSelectedClass("");
                                }}>
                                    <SelectTrigger className="h-11 bg-muted/50 border-border/50 rounded-xl">
                                        <SelectValue placeholder="Select Curriculum" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="8-4-4">8-4-4 (Forms)</SelectItem>
                                        <SelectItem value="CBC">CBC (Grades)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Class</label>
                                <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!assignmentCurriculum}>
                                    <SelectTrigger className="h-11 bg-muted/50 border-border/50 rounded-xl">
                                        <SelectValue placeholder="Choose a class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classesList
                                            .filter(c => {
                                                const name = c.name.toLowerCase();
                                                if (assignmentCurriculum === 'CBC') return name.startsWith('grade');
                                                if (assignmentCurriculum === '8-4-4') return name.startsWith('form');
                                                return true;
                                            })
                                            .map(cls => (
                                                <SelectItem key={cls.id} value={cls.id}>
                                                    {cls.name} ({cls.form_level})
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Teaching Subjects</label>
                                <p className="text-[10px] text-muted-foreground mt-1">Select one or more subjects applied strictly to all</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/20 rounded-xl border border-border/50">
                                {SUBJECTS.map(subject => {
                                    const isSelected = selectedSubjects.includes(subject);
                                    return (
                                        <div
                                            key={subject}
                                            onClick={() => toggleSubject(subject)}
                                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                                isSelected 
                                                    ? "bg-primary/20 border-primary/50 text-foreground" 
                                                    : "hover:bg-muted border-transparent text-muted-foreground"
                                            } border`}
                                        >
                                            <Checkbox checked={isSelected} />
                                            <span className="text-sm">{subject}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <Button 
                            onClick={handleBulkAssign} 
                            disabled={!selectedClass || selectedSubjects.length === 0}
                            className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg shadow-primary/20"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Confirm Bulk Assignment
                        </Button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
