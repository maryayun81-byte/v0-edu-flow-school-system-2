"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Trophy, TrendingUp, Users, Target, 
  BarChart3, Globe, Zap, AlertTriangle,
  ChevronRight, Brain, Sparkles, Loader2,
  Calendar, CheckCircle2, LayoutDashboard
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { ResultsCognitiveCore } from "@/lib/ai/ResultsCognitiveCore";
import { toast } from "sonner";

const supabase = createClient();

export default function AdminResultsPanel() {
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string>("");
  const [selectedForm, setSelectedForm] = useState("Form 3");
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [eventType, setEventType] = useState<'all' | 'tuition' | 'exam'>('all');
  const [classPerformance, setClassPerformance] = useState<any[]>([]);
  const [groupedResults, setGroupedResults] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchGlobalData();
  }, [selectedForm, selectedEventId, eventType]);

  async function fetchGlobalData() {
    setLoading(true);
    try {
      // 1. Fetch tuition events & exam events
      const { data: tuitionEvents } = await supabase
        .from('tuition_events')
        .select(`*, student_results(count)`)
        .order('start_date', { ascending: false });
      
      const { data: examEvents } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      const allEvents = [
        ...(tuitionEvents || []).map((e: any) => ({ ...e, type: 'tuition' as const, display_name: e.name })),
        ...(examEvents || []).map((e: any) => ({ ...e, type: 'exam' as const, display_name: e.exam_name }))
      ];
      setEvents(allEvents);

      // 2. Determine target event for analytics
      const activeEventId = selectedEventId !== 'all' ? selectedEventId : allEvents[0]?.id;

      // 3. Fetch Class Analytics if event is selected
      if (activeEventId) {
        const classStats = await ResultsCognitiveCore.fetchClassAnalytics(selectedForm, activeEventId);
        setAnalytics(classStats);
      }

      // 4. Fetch results and group by student
      let query = supabase
        .from('student_results')
        .select(`
          *,
          profiles!inner(full_name, form_class, admission_number)
        `)
        .ilike('profiles.form_class', selectedForm);
      
      if (selectedEventId !== 'all') {
        query = query.eq('event_id', selectedEventId);
      }

      const { data: results } = await query;

      if (results) {
        // Group by student
        const studentMap: Record<string, any> = {};
        results.forEach((r: any) => {
          if (!studentMap[r.student_id]) {
            studentMap[r.student_id] = {
              student_id: r.student_id,
              name: r.profiles.full_name,
              admission_number: r.profiles.admission_number,
              overall_grade: r.overall_grade,
              previous_overall_grade: r.previous_overall_grade,
              subjects: []
            };
          }
          studentMap[r.student_id].subjects.push({
            name: r.subject_name || 'General',
            grade: r.grade
          });
        });
        setGroupedResults(Object.values(studentMap));

        // Process heatmap (re-using grouped subjects)
        const heatmapData: Record<string, Record<string, number>> = {};
        results.forEach((r: any) => {
            const subj = r.subject_name || 'General';
            const gr = r.grade || 'C';
            if (!heatmapData[subj]) heatmapData[subj] = {};
            heatmapData[subj][gr] = (heatmapData[subj][gr] || 0) + 1;
        });
        setClassPerformance(Object.keys(heatmapData).map(subj => ({
            subject: subj,
            ...heatmapData[subj]
        })));
      }

      // 5. Global Stats (Accurate counts)
      const { count: totalSubmissions } = await supabase
        .from('student_results')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalSubmissions: totalSubmissions || 0,
        submissionRate: results?.length ? Math.round((results.length / (allEvents.length || 1)) * 10) : 0, // Mocked rate for now
        avgGrade: results && results.length > 0 ? ResultsCognitiveCore.numericToGrade(results.reduce((a: number, b: any) => a + ResultsCognitiveCore.gradeToNumeric(b.overall_grade), 0) / results.length) : 'N/A'
      });

    } catch (error) {
      console.error("Error fetching admin results:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateGlobalIntelligence() {
    setGeneratingReport(true);
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin-results-overview",
          data: {
            completionRate: stats?.completionRate || 0,
            lowPerformingClassesCount: 0,
            eventCount: events.length
          },
          context: { eventId: "admin-global" }
        })
      });

      const result = await response.json();
      setAiReport(result.insight);
      toast.success("Institutional report synthesized.");
    } catch (error) {
      toast.error("AI aggregation failed.");
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const paginatedResults = groupedResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(groupedResults.length / itemsPerPage);

  return (
    <div className="space-y-8 animate-in fade-in duration-1000">
      {/* 1. Filtering & Stats Header */}
      <div className="flex flex-col xl:flex-row gap-6 items-start justify-between">
        <div className="space-y-2">
           <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">Institutional Results Analytics</h2>
           <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Global Educational Flow Control Panel</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-card border border-border/50 p-4 rounded-[2rem] shadow-sm">
           <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-2xl border border-border/50">
              <Users className="w-4 h-4 text-primary" />
              <select 
                value={selectedForm} 
                onChange={(e) => { setSelectedForm(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer"
              >
                 {["Form 1", "Form 2", "Form 3", "Form 4"].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-2xl border border-border/50">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <select 
                value={selectedEventId} 
                onChange={(e) => { setSelectedEventId(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer max-w-[200px]"
              >
                <option value="all">All Events</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.display_name} ({e.type})
                  </option>
                ))}
              </select>
           </div>

           <div className="flex gap-2">
              <Button onClick={() => toast.info("Generating Global CSV...")} variant="outline" size="sm" className="rounded-xl px-4 font-black uppercase text-[10px] tracking-widest h-10 border-primary/20 hover:bg-primary/5">CSV</Button>
              <Button onClick={() => toast.info("Synthesizing PDF Report...")} variant="outline" size="sm" className="rounded-xl px-4 font-black uppercase text-[10px] tracking-widest h-10 border-primary/20 hover:bg-primary/5">PDF</Button>
           </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Class Average", value: analytics?.classInsight?.includes('improved') ? analytics.classInsight.split('by')[1].trim() : stats?.avgGrade || 'N/A', icon: Trophy, color: "text-amber-500", bg: "bg-amber-500/10", desc: "Cohort performance index" },
          { label: "Submission Mastery", value: `${Math.round((groupedResults.length / (analytics?.totalStudents || 1)) * 100)}%`, icon: Target, color: "text-emerald-500", bg: "bg-emerald-500/10", desc: "Actual student participation" },
          { label: "Total Data Points", value: stats?.totalSubmissions || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", desc: "Institutional result entries" },
          { label: "Improvement Delta", value: analytics?.classInsight?.match(/(\d+\.\d+%)|(\d+%)/)?.[0] || '0%', icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", desc: "Trajectory vs previous cycle" },
        ].map((m, i) => (
          <div key={i} className="group relative overflow-hidden bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all hover:scale-[1.02] cursor-default">
            <div className={`absolute top-0 right-0 w-32 h-32 ${m.bg} rounded-full blur-[60px] opacity-20 -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`} />
            <div className={`w-12 h-12 ${m.bg} ${m.color} rounded-2xl flex items-center justify-center mb-4 border border-white/10`}>
              <m.icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{m.label}</p>
            <p className="text-3xl font-black text-foreground tracking-tighter">{m.value}</p>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase mt-1">{m.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3. Analytics & Subject Performance */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-card border border-border/50 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                 <div>
                   <h3 className="text-xl font-black text-foreground tracking-tight uppercase">Subject Performance Matrix</h3>
                   <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Class-wide comparative analytics</p>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-[10px] font-black uppercase text-primary border border-primary/20">
                    <Sparkles className="w-3 h-3" />
                    RCCIC Enhanced
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={classPerformance} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis dataKey="subject" type="category" fontSize={10} fontWeight="900" width={100} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="A" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} barSize={20} />
                          <Bar dataKey="B" stackId="a" fill="#818cf8" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="C" stackId="a" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
                 
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Subject Insights</h4>
                    {analytics?.subjectComparison?.slice(0, 4).map((sc: any, idx: number) => (
                       <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                          <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-xl ${sc.improvement >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {sc.improvement >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                             </div>
                             <span className="text-sm font-bold text-foreground">{sc.subject}</span>
                          </div>
                          <span className={`text-xs font-black ${sc.improvement >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {sc.improvement >= 0 ? '+' : ''}{sc.improvement.toFixed(1)}%
                          </span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* 4. Intelligence Insight Panel */}
        <div className="lg:col-span-1">
           <div className="relative overflow-hidden bg-slate-950 rounded-[2.5rem] p-8 border border-primary/20 shadow-2xl group h-full flex flex-col justify-between">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] group-hover:bg-primary/30 transition-all duration-1000" />
              
              <div>
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                       <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-white tracking-tight uppercase">RCCIC Executive Synthesis</h3>
                       <p className="text-[10px] text-primary font-black uppercase tracking-widest">Active Report Cycle</p>
                    </div>
                 </div>

                 <div className="space-y-6">
                    {analytics ? (
                       <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                          <p className="text-base text-slate-300 leading-relaxed italic pr-4">
                             <Sparkles className="w-5 h-5 text-primary mb-3 inline-block" />
                             "{analytics.classInsight}"
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Top Performer</p>
                                <p className="text-sm font-bold text-emerald-400 uppercase">{analytics.topSubject}</p>
                             </div>
                             <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Risk Variable</p>
                                <p className="text-sm font-bold text-rose-400 uppercase">{analytics.hardestSubject}</p>
                             </div>
                          </div>
                       </div>
                    ) : (
                       <p className="text-sm text-slate-400 font-medium">
                          Select an evaluation event to generate a class-wide cognitive performance synthesis.
                       </p>
                    )}
                 </div>
              </div>

              <Button
                onClick={generateGlobalIntelligence}
                disabled={generatingReport || !analytics}
                className="mt-12 w-full h-16 rounded-[1.5rem] bg-white text-slate-950 hover:bg-indigo-50 font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-white/5 transition-all active:scale-95"
              >
                {generatingReport ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                Refresh Intelligence
              </Button>
           </div>
        </div>
      </div>

      {/* 5. Consolidated Student Results Cards */}
      <div className="space-y-6">
         <div className="flex items-center justify-between px-2">
            <div>
               <h3 className="text-2xl font-black text-foreground tracking-tight uppercase">Consolidated Student Outcomes</h3>
               <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Actual Submissions per Student</p>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Students</p>
               <p className="text-2xl font-black text-foreground">{groupedResults.length}</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedResults.map((student, idx) => (
               <div key={student.student_id} className="relative overflow-hidden bg-card border border-border/50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-black text-primary border border-border/50">
                           {student.name.charAt(0)}
                        </div>
                        <div>
                           <p className="text-base font-black text-foreground tracking-tight">{student.name}</p>
                           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{student.admission_number}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Overall</p>
                        <div className={`px-3 py-1 rounded-full font-black text-lg ${
                           ResultsCognitiveCore.gradeToNumeric(student.overall_grade) >= 0.78 ? 'text-emerald-500 bg-emerald-500/10' : 
                           ResultsCognitiveCore.gradeToNumeric(student.overall_grade) >= 0.60 ? 'text-indigo-500 bg-indigo-500/10' : 
                           'text-rose-500 bg-rose-500/10'
                        }`}>
                           {student.overall_grade}
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-3 mb-6">
                     {student.subjects.map((s: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border/50">
                           <span className="text-[10px] font-bold text-muted-foreground uppercase truncate pr-2">{s.name}</span>
                           <span className="text-xs font-black text-foreground">{s.grade}</span>
                        </div>
                     ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/30">
                     <div className="flex items-center gap-2">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Previous Cycle:</p>
                        <p className="text-xs font-black text-muted-foreground">{student.previous_overall_grade || 'None'}</p>
                     </div>
                     <div className={`flex items-center gap-1 ${
                        ResultsCognitiveCore.gradeToNumeric(student.overall_grade) >= ResultsCognitiveCore.gradeToNumeric(student.previous_overall_grade || 'C') 
                        ? 'text-emerald-500' : 'text-rose-500'
                     }`}>
                        {ResultsCognitiveCore.gradeToNumeric(student.overall_grade) >= ResultsCognitiveCore.gradeToNumeric(student.previous_overall_grade || 'C') 
                          ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                           {ResultsCognitiveCore.gradeToNumeric(student.overall_grade) >= ResultsCognitiveCore.gradeToNumeric(student.previous_overall_grade || 'C') ? 'Improved' : 'Decline'}
                        </span>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Pagination */}
         {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-8">
               <Button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
                variant="outline" 
                className="rounded-2xl h-12 w-12 p-0 border-border/50"
               >
                 <ChevronRight className="w-5 h-5 rotate-180" />
               </Button>
               <div className="bg-card border border-border/50 px-6 py-3 rounded-2xl">
                  <span className="text-xs font-black tracking-widest text-muted-foreground uppercase">Page {currentPage} of {totalPages}</span>
               </div>
               <Button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
                variant="outline" 
                className="rounded-2xl h-12 w-12 p-0 border-border/50"
               >
                 <ChevronRight className="w-5 h-5" />
               </Button>
            </div>
         )}
      </div>
    </div>
  );
}
