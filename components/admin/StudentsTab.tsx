"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search, Users, GraduationCap, School, Layers,
  ChevronLeft, ChevronRight, Edit2, Trash2, Shield, MoreVertical, LayoutGrid, Check, X,
  BookOpen
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

interface StudentProfile {
  id: string;
  full_name: string;
  admission_number: string;
  school_name: string;
  form_class: string;
  subjects: string[];
  curriculum_type?: 'CBC' | '8-4-4';
  created_at: string;
}

const ITEMS_PER_PAGE = 8;
const EDUCATION_SYSTEMS = ["8-4-4", "CBC"];

export default function StudentsTab() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [classesList, setClassesList] = useState<{id: string, name: string}[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [curriculumFilter, setCurriculumFilter] = useState("all");
  
  // Selection / Bulk actions
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  // Insights logic
  const [insights, setInsights] = useState({
    total: 0,
    cbcCount: 0,
    traditionalCount: 0,
    missingCurriculum: 0
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [currentPage, classFilter, curriculumFilter, searchQuery]);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    if (data) setClassesList(data);
  }

  async function fetchStudents() {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select(`
        id, full_name, admission_number, school_name, form_class, subjects, curriculum_type, created_at
      `, { count: 'exact' })
      .eq('role', 'student');

    if (searchQuery) {
      // Support searching by name or admission number via OR condition
      query = query.or(`full_name.ilike.%${searchQuery}%,admission_number.ilike.%${searchQuery}%`);
    }

    if (curriculumFilter !== 'all') {
      query = query.eq('curriculum_type', curriculumFilter);
    }
    
    // Fallback: the form_class string if they are directly linked via class name (based on DB structure)
    if (classFilter !== 'all') {
        const selectedClassNode = classesList.find(c => c.id === classFilter);
        if (selectedClassNode) {
             query = query.eq('form_class', selectedClassNode.name);
        }
    }

    // Pagination
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, count, error } = await query;
    if (error) {
      toast.error("Failed to load students");
      setLoading(false);
      return;
    }

    if (data) {
      setStudents(data);
      setTotalCount(count || data.length);
      calculateInsights(data);
    }
    setLoading(false);
  }

  function calculateInsights(data: StudentProfile[]) {
    let cbc = 0, trad = 0, missing = 0;
    data.forEach(s => {
      if (s.curriculum_type === 'CBC') cbc++;
      else if (s.curriculum_type === '8-4-4') trad++;
      else missing++;
    });
    setInsights({
      total: data.length, 
      cbcCount: cbc,
      traditionalCount: trad,
      missingCurriculum: missing
    });
  }

  function handleSelectAll() {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  }

  function toggleStudentSelection(id: string) {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(sId => sId !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  }

  async function handleDeleteStudent(id: string) {
    if (!confirm("Remove this student? This cannot be undone.")) return;
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Student removed");
      fetchStudents();
    } catch (e: any) {
      toast.error("Failed to remove: " + e.message);
    }
  }

  async function handleBulkDelete() {
      if (!confirm(`Delete ${selectedStudents.length} students? This cannot be undone.`)) return;
      try {
          // We issue individual deletes or use an in query (if RLS allows batch ops easily)
          const { error } = await supabase.from("profiles").delete().in('id', selectedStudents);
          if (error) throw error;
          
          toast.success(`${selectedStudents.length} students removed`);
          setSelectedStudents([]);
          fetchStudents();
      } catch (e: any) {
          toast.error("Bulk delete failed: " + e.message);
      }
  }

  async function handleUpdateCurriculum(studentId: string, currentType: string) {
    const newType = currentType === 'CBC' ? '8-4-4' : 'CBC';
    if (!confirm(`Switch student curriculum to ${newType}?`)) return;
    
    try {
        const { error } = await supabase.from("profiles").update({ curriculum_type: newType }).eq("id", studentId);
        if (error) throw error;
        toast.success(`Curriculum updated to ${newType}`);
        fetchStudents();
    } catch (e: any) {
        toast.error("Failed to update curriculum: " + e.message);
    }
  }

  const Pagination = () => {
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-8 bg-card/50 p-4 rounded-2xl border border-border/50">
        <span className="text-sm font-medium text-muted-foreground">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} students
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
                <GraduationCap className="w-24 h-24 text-chart-3" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Student Demographics</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-3xl font-black text-foreground">{insights.total}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Displayed</p>
                </div>
                <div>
                    <p className="text-3xl font-black text-indigo-500">{insights.traditionalCount}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">8-4-4 System</p>
                </div>
                <div>
                    <p className="text-3xl font-black text-green-500">{insights.cbcCount}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">CBC System</p>
                </div>
                {insights.missingCurriculum > 0 && (
                  <div>
                      <p className="text-3xl font-black text-amber-500">{insights.missingCurriculum}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Unspecified</p>
                  </div>
                )}
            </div>
        </div>

        {/* Filter Panel */}
        <div className="lg:w-2/3 bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search students by name or admission number..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-background/50 border-border/50 rounded-xl"
                    />
                </div>
                {selectedStudents.length > 0 && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2 animate-in slide-in-from-right-4">
                        <span className="text-sm font-bold text-destructive">{selectedStudents.length} selected</span>
                        <div className="w-px h-4 bg-destructive/20 mx-2" />
                        <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-destructive hover:bg-destructive/20" onClick={handleBulkDelete}>Delete</Button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Class Filter</label>
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Curriculum</label>
                    <Select value={curriculumFilter} onValueChange={setCurriculumFilter}>
                        <SelectTrigger className="h-10 bg-background/50 border-border/50 rounded-xl">
                            <SelectValue placeholder="All Curriculums" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Curriculums</SelectItem>
                            {EDUCATION_SYSTEMS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

      </div>

      {/* 2. Students Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
                <Checkbox 
                    checked={students.length > 0 && selectedStudents.length === students.length}
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
                    <div key={i} className="h-[320px] rounded-[2rem] bg-card border border-border/50 animate-pulse" />
                ))}
             </div>
        ) : students.length === 0 ? (
             <div className="text-center py-24 bg-card/30 border border-border/50 rounded-[2rem] border-dashed">
                 <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                     <GraduationCap className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-bold text-foreground">No students found</h3>
                 <p className="text-sm text-muted-foreground mt-1 mb-6">Try adjusting your filters or search query.</p>
                 <Button onClick={() => {
                     setSearchQuery("");
                     setClassFilter("all");
                     setCurriculumFilter("all");
                 }} variant="outline" className="rounded-xl">
                     Reset Filters
                 </Button>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {students.map(student => {
                    const isCBC = student.curriculum_type === 'CBC';
                    const gradientTheme = isCBC ? 'from-green-500/20 to-green-500/5 border-green-500/20' : 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20';
                    const iconColor = isCBC ? 'text-green-500' : 'text-indigo-500';

                    return (
                        <div 
                            key={student.id} 
                            className={`group bg-card transition-all duration-300 border rounded-[2rem] overflow-hidden hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 relative flex flex-col ${
                                selectedStudents.includes(student.id) ? 'border-destructive ring-1 ring-destructive/20 bg-destructive/[0.02]' : 'border-border/50'
                            }`}
                        >
                            <div className="absolute top-4 left-4 z-10">
                                <Checkbox 
                                    checked={selectedStudents.includes(student.id)}
                                    onCheckedChange={() => toggleStudentSelection(student.id)}
                                    className={`transition-opacity ${selectedStudents.includes(student.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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
                                        <DropdownMenuItem onClick={() => handleUpdateCurriculum(student.id, student.curriculum_type || '8-4-4')}>
                                            <Layers className="w-4 h-4 mr-2" /> Switch Curriculum
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteStudent(student.id)}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Remove Student
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className={`p-6 pb-4 text-center border-b border-border/50 bg-gradient-to-b ${gradientTheme}`}>
                                <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                                    <span className={`text-xl font-black ${iconColor}`}>
                                        {student.full_name?.[0]?.toUpperCase() || "S"}
                                    </span>
                                </div>
                                <h3 className="font-bold text-foreground text-lg tracking-tight truncate leading-tight">{student.full_name || "Unknown Student"}</h3>
                                <p className="text-xs font-mono text-muted-foreground mt-1 tracking-wider">{student.admission_number || "NO-ADM-NUM"}</p>
                                
                                <div className="mt-3">
                                     <button 
                                        onClick={() => handleUpdateCurriculum(student.id, student.curriculum_type || '8-4-4')}
                                        className={`inline-flex items-center text-[10px] uppercase font-black px-2.5 py-1 rounded-full border transition-colors hover:scale-105 ${
                                            isCBC 
                                                ? 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20' 
                                                : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/20'
                                        }`}
                                        title="Click to toggle Curriculum"
                                     >
                                        {student.curriculum_type || '8-4-4'} System
                                     </button>
                                </div>
                            </div>

                            <div className="p-5 flex-1 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5">
                                            <School className="w-3.5 h-3.5" /> Class
                                        </span>
                                        <span className="text-sm font-bold text-foreground">{student.form_class || "—"}</span>
                                    </div>
                                    
                                    <div>
                                        <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 mb-2">
                                            <BookOpen className="w-3.5 h-3.5" /> Registered Subjects
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(student.subjects || []).slice(0, 6).map(subject => (
                                                <Badge key={subject} variant="outline" className="text-[10px] bg-muted/50 font-medium">
                                                    {subject}
                                                </Badge>
                                            ))}
                                            {(student.subjects || []).length > 6 && (
                                                <Badge variant="secondary" className="text-[10px] bg-foreground/5 font-bold">
                                                    +{(student.subjects || []).length - 6}
                                                </Badge>
                                            )}
                                            {!(student.subjects || []).length && (
                                                <span className="text-xs text-muted-foreground italic">No subjects selected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        <Pagination />
      </div>
    </div>
  );
}
