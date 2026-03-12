"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Trophy, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  School,
  FileText,
  ChevronDown,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

const supabase = createClient();

interface EligibilityRow {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  attendance_percentage: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  days_recorded: number;
  total_eval_days: number;
  is_eligible: boolean;
}

interface TuitionEvent {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  attendance_eval_days?: number;
}

export default function EligibleStudentsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  
  // Weekly Details Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<EligibilityRow | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalWeeks, setModalWeeks] = useState<{label: string, dayMap: Record<string, string>, attended: number, total: number}[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchEligibility();
    }
  }, [selectedEventId, selectedClass, page, searchQuery]);

  async function fetchInitialData() {
    // 1. Fetch Events (Active first)
    const { data: eventsData } = await supabase
      .from("tuition_events")
      .select("id, name, status, start_date, attendance_eval_days")
      .order("status", { ascending: true }) // active comes before upcoming/completed
      .order("start_date", { ascending: false });
    
    setEvents(eventsData || []);
    if (eventsData && eventsData.length > 0) {
      const active = eventsData.find((e: any) => e.status === "active");
      setSelectedEventId(active?.id || eventsData[0].id);
    }

    // 2. Fetch Classes for filter
    const { data: classesData } = await supabase
      .from("classes")
      .select("id, name")
      .order("name");
    
    setClasses(classesData || []);
  }

  async function fetchEligibility() {
    setLoading(true);
    try {
      // Calculate range
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("exam_eligibility")
        .select(`
          student_id, attendance_percentage, is_eligible,
          days_present, days_late, days_absent, total_eval_days,
          profiles!exam_eligibility_student_id_fkey(full_name, admission_number),
          classes!exam_eligibility_class_id_fkey(name)
        `, { count: "exact" })
        .eq("event_id", selectedEventId);

      if (selectedClass !== "all") {
        query = query.eq("class_id", selectedClass);
      }

      if (searchQuery) {
        query = query.ilike("profiles.full_name", `%${searchQuery}%`);
      }

      const { data, count, error } = await query
        .order("is_eligible", { ascending: false })
        .order("attendance_percentage", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setStudents(data?.map((r: any) => ({
        student_id: r.student_id,
        student_name: r.profiles?.full_name || "Unknown",
        admission_number: r.profiles?.admission_number || "N/A",
        class_name: r.classes?.name || "Unknown",
        attendance_percentage: Number(r.attendance_percentage),
        days_present: r.days_present,
        days_late: r.days_late,
        days_absent: r.days_absent,
        days_recorded: r.days_present + r.days_late + r.days_absent,
        is_eligible: r.is_eligible
      })) || []);

      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / limit));

      // --- Debug Logging ---
      console.log(`[DEBUG] Selected Event: ${selectedEventId}`);
      console.log(`[DEBUG] Selected Class: ${selectedClass === 'all' ? 'All Classes' : classes.find((c: any) => c.id === selectedClass)?.name || selectedClass}`);
      console.log(`[DEBUG] Eligible Students Returned: ${data?.length || 0}`);
    } catch (error: any) {
      console.error("Fetch Eligibility Error:", error);
      toast.error("Failed to load eligibility records");
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    toast.success("Generating Exam Register PDF...");
    // Mock export logic
  }

  async function handleViewDetails(student: EligibilityRow) {
    setSelectedStudent(student);
    setShowModal(true);
    setModalLoading(true);
    
    const { data, error } = await supabase
      .from('attendance')
      .select('attendance_date, status')
      .eq('event_id', selectedEventId)
      .eq('student_id', student.student_id)
      .order('attendance_date', { ascending: true });

    if (data && data.length > 0) {
        const event = events.find(e => e.id === selectedEventId);
        const startDate = event?.start_date ? new Date(event.start_date) : new Date(String(data[0].attendance_date));
        const weeks: Record<string, any[]> = {};
        
        data.forEach((r: any) => {
           const curDate = new Date(String(r.attendance_date));
           const diffTime = Math.abs(curDate.getTime() - startDate.getTime());
           const weekNum = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
           const weekKey = `Week ${weekNum}`;
           if (!weeks[weekKey]) weeks[weekKey] = [];
           weeks[weekKey].push(r);
        });
        
        const processedWeeks = Object.entries(weeks).map(([label, records]) => {
           const dayMap = records.reduce((acc: any, r: any) => {
               const dayShort = new Date(String(r.attendance_date) + "T00:00:00").toLocaleDateString('en-US', { weekday: 'short' });
               acc[dayShort] = r.status === 'present' || r.status === 'late' ? '✓' : '✗';
               return acc;
           }, {});
           
           const attended = records.filter(r => r.status === 'present' || r.status === 'late').length;
           
           return { label, dayMap, attended, total: 5 };
        });
        setModalWeeks(processedWeeks);
    } else {
        setModalWeeks([]);
    }
    
    setModalLoading(false);
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
                <Link href="/admin/dashboard?tab=attendance" className="text-xs font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 hover:opacity-70 transition-opacity">
                    <ArrowLeft className="w-3 h-3" /> Back to Dashboard
                </Link>
                <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                    <Trophy className="w-10 h-10 text-primary" />
                    ELIGIBLE EXAM STUDENTS
                </h1>
                <p className="text-muted-foreground font-medium">Institutional qualification audit and exam registry management.</p>
            </div>
            
            <div className="flex items-center gap-3">
                <Button variant="outline" className="h-12 rounded-2xl border-border/50 bg-card font-black" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" /> Export Register
                </Button>
                <Button className="h-12 rounded-2xl bg-primary font-black shadow-lg shadow-primary/20" onClick={() => router.push('/admin/dashboard?tab=exams')}>
                    <FileText className="w-4 h-4 mr-2" /> Schedule Final Exam
                </Button>
            </div>
        </div>

        {/* Global Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-card border border-border/50 rounded-3xl p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Total Monitored</p>
                <div className="text-3xl font-black text-foreground">{totalCount}</div>
             </div>
             <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-2">Eligible</p>
                <div className="text-3xl font-black text-foreground">{students.filter(s => s.is_eligible).length}</div>
             </div>
             <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Borderline</p>
                <div className="text-3xl font-black text-foreground">{students.filter(s => !s.is_eligible && s.attendance_percentage >= 70).length}</div>
             </div>
             <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Disqualified</p>
                <div className="text-3xl font-black text-foreground">{students.filter(s => !s.is_eligible && s.attendance_percentage < 70).length}</div>
             </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tuition Event</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select 
                            value={selectedEventId}
                            onChange={e => { setSelectedEventId(e.target.value); setPage(1); }}
                            className="w-full bg-background border border-border/50 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                        >
                            {events.map(e => (
                                <option key={e.id} value={e.id}>{e.name} {e.status === 'active' ? '(ACTIVE)' : ''}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Class</label>
                    <div className="relative">
                        <School className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select 
                            value={selectedClass}
                            onChange={e => { setSelectedClass(e.target.value); setPage(1); }}
                            className="w-full bg-background border border-border/50 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                        >
                            <option value="all">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Search Scholar</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text"
                            placeholder="Type name or admission number..."
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                            className="w-full bg-background border border-border/50 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/40"
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Intelligence Table / Card Layout */}
        <div className="space-y-4">
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Compiling Records...</p>
                </div>
            ) : students.length > 0 ? (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-card border border-border/50 rounded-[2rem] overflow-hidden shadow-xl">
                        <table className="w-full text-left">
                            <thead className="bg-muted/30 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Student info</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Attendance %</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Days marks</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Sessions</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {students.map(s => (
                                    <tr key={s.student_id} className="hover:bg-muted/10 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${s.is_eligible ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {s.student_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-foreground">{s.student_name}</p>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{s.admission_number} • {s.class_name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="inline-block px-3 py-1 rounded-full bg-background border border-border/50 text-sm font-black">
                                                {s.attendance_percentage}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center font-bold text-muted-foreground">
                                            {s.days_recorded}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex items-center justify-center gap-2 text-xs font-bold">
                                                <span className="text-green-500">{s.days_present + s.days_late}P</span>
                                                <span className="text-muted-foreground">/</span>
                                                <span className="text-red-500">{s.days_absent}A</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {s.is_eligible ? (
                                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30 font-black tracking-widest">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> ELIGIBLE
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-red-500/20 text-red-500 border-red-500/30 hover:bg-red-500/30 font-black tracking-widest">
                                                    <XCircle className="w-3 h-3 mr-1" /> DISQUALIFIED
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="rounded-xl font-bold text-xs uppercase hover:bg-primary/10 hover:text-primary"
                                                onClick={() => handleViewDetails(s)}
                                            >
                                                Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden space-y-4">
                        {students.map(s => (
                            <div key={s.student_id} className="bg-card border border-border/50 rounded-3xl p-5 space-y-4 shadow-lg">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${s.is_eligible ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                            {s.student_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground">{s.student_name}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{s.admission_number}</p>
                                        </div>
                                    </div>
                                    {s.is_eligible ? (
                                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-black">ELIGIBLE</Badge>
                                    ) : (
                                        <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-black">DISQUALIFIED</Badge>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-background/50 p-3 rounded-2xl border border-border/30">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Attendance</p>
                                        <p className="text-xl font-black text-foreground">{s.attendance_percentage}%</p>
                                    </div>
                                    <div className="bg-background/50 p-3 rounded-2xl border border-border/30">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Sessions</p>
                                        <p className="text-xl font-black text-foreground">{s.days_recorded}</p>
                                    </div>
                                </div>
                                <Button 
                                    className="w-full h-12 rounded-2xl bg-muted text-foreground font-black uppercase text-xs tracking-widest"
                                    onClick={() => handleViewDetails(s)}
                                >
                                    View Details
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Advanced Pagination */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6">
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                            Showing <span className="text-foreground">{limit * (page - 1) + 1}</span> to <span className="text-foreground">{Math.min(limit * page, totalCount)}</span> of <span className="text-foreground">{totalCount}</span> scholars
                        </p>
                        
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl border-border/50 h-10 w-10 p-0"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            
                            <div className="flex items-center gap-1">
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const p = i + 1;
                                    return (
                                        <Button
                                            key={p}
                                            variant={page === p ? "default" : "outline"}
                                            size="sm"
                                            className={`rounded-xl h-10 w-10 p-0 font-black ${page === p ? 'bg-primary shadow-lg shadow-primary/20' : 'border-border/50'}`}
                                            onClick={() => setPage(p)}
                                        >
                                            {p}
                                        </Button>
                                    );
                                })}
                                {totalPages > 5 && <span className="text-muted-foreground px-2">...</span>}
                            </div>

                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl border-border/50 h-10 w-10 p-0"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="py-32 bg-card/30 border border-border/50 border-dashed rounded-[3rem] text-center space-y-4">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                        <Search className="w-10 h-10 text-muted-foreground opacity-20" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground tracking-tight uppercase">No matching scholars</h3>
                    <p className="text-muted-foreground font-medium max-w-sm mx-auto italic">
                        The intelligence engine could not find any records matching your current filter criteria.
                    </p>
                    <Button variant="outline" className="rounded-xl font-black mt-4" onClick={() => { setSelectedClass("all"); setSearchQuery(""); }}>
                        Clear All Filters
                    </Button>
                </div>
            )}
        </div>
      </div>

      {/* Details Modal */}
      {showModal && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-card border border-border/50 rounded-3xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-border/50 flex flex-col gap-2 relative z-10">
                      <div className="flex items-center justify-between">
                          <h2 className="text-xl font-black text-foreground">Student Attendance Details</h2>
                          <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="rounded-xl">
                              <XCircle className="w-5 h-5 text-muted-foreground" />
                          </Button>
                      </div>
                      <div className="text-sm font-medium text-muted-foreground mt-4 grid grid-cols-2 gap-2">
                          <div><span className="font-bold text-foreground">Student:</span> {selectedStudent.student_name}</div>
                          <div><span className="font-bold text-foreground">Class:</span> {selectedStudent.class_name}</div>
                          <div className="col-span-2"><span className="font-bold text-foreground">Event:</span> {events.find(e => e.id === selectedEventId)?.name}</div>
                      </div>
                  </div>
                  
                  <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
                      {modalLoading ? (
                          <div className="py-12 flex items-center justify-center">
                              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                          </div>
                      ) : (
                          <>
                              <div>
                                  <h3 className="text-xs font-black text-foreground uppercase tracking-widest mb-4">Weekly Attendance Breakdown</h3>
                                  {modalWeeks.length > 0 ? (
                                      <div className="space-y-6">
                                          {modalWeeks.map((week, idx) => (
                                              <div key={idx} className="bg-background/50 border border-border/50 rounded-2xl p-4">
                                                  <p className="font-bold text-sm text-foreground mb-3">{week.label}</p>
                                                  <div className="grid grid-cols-6 gap-2 mb-4">
                                                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                          <div key={d} className="flex flex-col items-center gap-1">
                                                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{d}</span>
                                                              <span className={`text-sm font-black ${week.dayMap[d] === '✓' ? 'text-green-500' : 'text-red-500 '}`}>
                                                                  {week.dayMap[d] || '—'}
                                                              </span>
                                                          </div>
                                                      ))}
                                                  </div>
                                                  <div className="text-xs font-bold text-muted-foreground border-t border-border/30 pt-3 flex justify-between">
                                                      <span>Attended:</span>
                                                      <span className="text-foreground">{week.attended}/{week.total}</span>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <p className="text-sm italic text-muted-foreground">No records found for this student.</p>
                                  )}
                              </div>

                              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
                                  <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-2 border-b border-primary/10 pb-2">Summary Section</h3>
                                  <div className="flex justify-between text-sm">
                                      <span className="font-bold text-muted-foreground">Total Sessions Conducted:</span>
                                      <span className="text-foreground font-black">{selectedStudent.total_eval_days || selectedStudent.days_recorded}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="font-bold text-muted-foreground">Sessions Attended:</span>
                                      <span className="text-foreground font-black">{selectedStudent.days_present + selectedStudent.days_late}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="font-bold text-muted-foreground">Attendance Rate:</span>
                                      <span className={`font-black ${selectedStudent.attendance_percentage >= 70 ? 'text-green-500' : 'text-red-500'}`}>{selectedStudent.attendance_percentage}%</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="font-bold text-muted-foreground">Risk Score:</span>
                                      <span className="text-amber-500 font-black">{Math.round((selectedStudent.days_absent / Math.max(1, selectedStudent.total_eval_days || selectedStudent.days_recorded)) * 100)}%</span>
                                  </div>
                                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-primary/10">
                                      <span className="font-bold text-muted-foreground">Eligibility Status:</span>
                                      <span className={`font-black uppercase ${selectedStudent.is_eligible ? 'text-green-500' : 'text-red-500'}`}>{selectedStudent.is_eligible ? 'Eligible' : 'Not Eligible'}</span>
                                  </div>
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
