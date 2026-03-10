"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Trophy, TrendingUp, TrendingDown, Minus, Users, Search, 
  Filter, Share2, BarChart3,
  ChevronRight, Brain, Sparkles, Loader2,
  LayoutGrid, List, Library
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { Button } from "@/components/ui/button";
import { ResultsCognitiveCore, ResultsMetrics, ClassAnalytics } from "@/lib/ai/ResultsCognitiveCore";
import { CognitiveCore, ClassificationZone } from "@/lib/ai/CognitiveCore";
import { toast } from "sonner";

const supabase = createClient();

interface TeacherResultsManagerProps {
  teacherId: string;
}

export default function TeacherResultsManager({ teacherId }: TeacherResultsManagerProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [aiInsight, setAiInsight] = useState<string>("");
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [otherTeachers, setOtherTeachers] = useState<any[]>([]);
  const [sharingWith, setSharingWith] = useState<string>("");
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics | null>(null);
  const [globalStats, setGlobalStats] = useState<{ successIndex: number; dropoutRisk: number; zone: ClassificationZone } | null>(null);
  const [showIntelligenceHub, setShowIntelligenceHub] = useState(false);

  // Pagination & Filtering
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const [totalCount, setTotalCount] = useState(0);
  const [searchName, setSearchName] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [searchDate, setSearchDate] = useState("");

  // Helper Functions & Derived Data
  const getGradeDistribution = () => {
    const distribution: Record<string, number> = {};
    results.forEach((r: any) => {
      distribution[r.overall_grade] = (distribution[r.overall_grade] || 0) + 1;
    });
    return Object.entries(distribution).map(([grade, count]) => ({ grade, count }));
  };

  const chartData = getGradeDistribution();

  useEffect(() => {
    fetchEvents();
    fetchOtherTeachers();
    fetchGlobalStats();
  }, []);

  async function fetchGlobalStats() {
    const stats = await CognitiveCore.getGlobalMetrics();
    setGlobalStats(stats);
  }

  useEffect(() => {
    if (selectedEventId) {
      fetchResults();
      // Load class analytics whenever event changes
      ResultsCognitiveCore.generateClassAnalytics(selectedEventId)
        .then(setClassAnalytics)
        .catch(() => {});
    }
  }, [selectedEventId, page, pageSize, searchName, selectedClass, searchDate]);

  async function fetchEvents() {
    const { data } = await supabase
      .from('tuition_events')
      .select('*')
      .order('start_date', { ascending: false });
    
    setEvents(data || []);
    if (data && data.length > 0) setSelectedEventId(data[0].id);
  }

  async function fetchOtherTeachers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'teacher')
      .neq('id', teacherId);
    setOtherTeachers(data || []);
  }

  async function fetchResults() {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          admission_number,
          form_class,
          student_results!inner(*)
        `, { count: 'exact' })
        .eq('student_results.event_id', selectedEventId);

      if (searchName) query = query.ilike('full_name', `%${searchName}%`);
      if (selectedClass) query = query.ilike('form_class', `%${selectedClass}%`);
      
      // Time filter on any result submission
      if (searchDate) {
        query = query.gte('student_results.submitted_at', searchDate);
      }

      const { data: profilesData, count, error } = await query
        .order('full_name', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      
      setTotalCount(count || 0);

      // Map profiles to the format expected by the card
      const mappedResults = (profilesData || []).map((p: any) => {
        const firstResult = p.student_results[0];
        return {
          id: p.id + selectedEventId,
          student_id: p.id,
          event_id: selectedEventId,
          event_name: events.find(e => e.id === selectedEventId)?.name || 'Unknown Event',
          overall_grade: firstResult.overall_grade,
          previous_overall_grade: firstResult.previous_overall_grade,
          submitted_at: firstResult.submitted_at,
          profiles: {
            full_name: p.full_name,
            admission_number: p.admission_number,
            form_class: p.form_class
          },
          subjects: p.student_results.map((r: any) => ({
            name: r.subject_name,
            grade: r.grade
          }))
        };
      });

      // Enhance with advanced cognitive signals
      const enhancedResults = await Promise.all(
        mappedResults.map(async (res: any) => {
          const metrics = await ResultsCognitiveCore.analyzeCrossEventPerformance(res.student_id);
          const narrative = await ResultsCognitiveCore.generateStudentNarrative(res.student_id, selectedEventId);
          return { ...res, metrics, narrative };
        })
      );

      setResults(enhancedResults);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Failed to load results.");
    } finally {
      setLoading(false);
    }
  }

  async function generateClassInsight() {
    if (results.length === 0) return;
    setGeneratingInsight(true);
    try {
      const classAvgNumeric = results.reduce((sum, r) => sum + ResultsCognitiveCore.gradeToNumeric(r.overall_grade), 0) / results.length;

      if (classAnalytics?.classInsight) {
        setAiInsight(classAnalytics.classInsight);
        toast.success("Intelligence report deployed.");
        return;
      }

      setAiInsight("Analyzing class performance patterns... Generating tactical advice via RCCIC engine.");

      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "teacher-class-results",
          data: {
            classAverage: classAvgNumeric,
            studentCount: results.length,
            gradeCounts: chartData,
            event: events.find(e => e.id === selectedEventId)?.name
          },
          context: { teacherId }
        })
      });

      const result = await response.json();
      setAiInsight(result.insight || classAnalytics?.classInsight || "Standard performance patterns detected. Focus on subject difficulty normalization.");
      toast.success("Intelligence report generated.");
    } catch (error) {
       toast.error("AI engine currently busy.");
    } finally {
      setGeneratingInsight(false);
    }
  }

  async function handleShare(studentId: string) {
    if (!sharingWith) {
      toast.warning("Please select a teacher to share with.");
      return;
    }

    try {
      const { error } = await supabase
        .from('teacher_results_share')
        .insert({
          from_teacher_id: teacherId,
          to_teacher_id: sharingWith,
          event_id: selectedEventId,
          student_id: studentId
        });
      
      if (error) throw error;
      toast.success("Results shared successfully.");
    } catch (error) {
      toast.error("Failed to share results.");
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      {/* Header & Global Intelligence */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-2 h-8 bg-indigo-500 rounded-full" />
             <h2 className="text-4xl font-black text-white tracking-tighter">RESULTS INTELLIGENCE</h2>
          </div>
          <p className="text-xs text-indigo-300 font-bold uppercase tracking-[0.4em] opacity-60">RCCIC Cognitive Analysis & Tactical Deployment</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-xl">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-transparent border-none text-[10px] sm:text-sm font-black text-white outline-none px-2 sm:px-4 py-2 cursor-pointer"
          >
            {events.map(e => <option key={e.id} value={e.id} className="bg-slate-900">{e.name}</option>)}
          </select>
          
          <div className="hidden sm:block h-6 w-px bg-white/10" />

          <div className="flex gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-gray-400 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <Button
            variant="ghost"
            onClick={() => setShowIntelligenceHub(!showIntelligenceHub)}
            className={`h-10 px-3 sm:px-4 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest gap-2 transition-all ${showIntelligenceHub ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Brain className={`w-4 h-4 ${showIntelligenceHub ? 'animate-pulse' : ''}`} />
            <span className="hidden xs:inline">{showIntelligenceHub ? 'Close' : 'Intelligence Hub'}</span>
            <span className="xs:hidden">{showIntelligenceHub ? 'Close' : 'Hub'}</span>
          </Button>
        </div>
      </div>

      {/* RCCIC Intelligence Hub (Collapsible) */}
      <div className={`transition-all duration-700 ease-in-out overflow-hidden ${showIntelligenceHub ? 'max-h-[2000px] opacity-100 mb-6' : 'max-h-0 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-5">

          {/* Top Row: Class Health Stats + Grade Chart side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* Left: Class Health */}
            {classAnalytics && classAnalytics.totalStudents > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Class Health · {classAnalytics.totalStudents} Students</span>
                </div>

                {/* 3 stat pills */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Strong", count: classAnalytics.strongStudents, pct: Math.round((classAnalytics.strongStudents / classAnalytics.totalStudents) * 100), color: "text-emerald-400", bar: "bg-emerald-500", border: "border-emerald-500/20" },
                    { label: "Moderate", count: classAnalytics.moderateStudents, pct: Math.round((classAnalytics.moderateStudents / classAnalytics.totalStudents) * 100), color: "text-amber-400", bar: "bg-amber-500", border: "border-amber-500/20" },
                    { label: "At Risk", count: classAnalytics.atRiskStudents, pct: Math.round((classAnalytics.atRiskStudents / classAnalytics.totalStudents) * 100), color: "text-rose-400", bar: "bg-rose-500", border: "border-rose-500/20" },
                  ].map((b, i) => (
                    <div key={i} className={`bg-black/30 rounded-2xl p-4 border ${b.border} text-center`}>
                      <p className={`text-2xl font-black ${b.color}`}>{b.pct}%</p>
                      <p className={`text-[9px] font-black ${b.color} uppercase tracking-widest mt-0.5`}>{b.label}</p>
                      <p className="text-[9px] text-slate-600 mt-0.5">{b.count} students</p>
                      <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${b.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subject difficulty compact list */}
                {classAnalytics.subjectDifficulty.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Subject Difficulty</p>
                    {classAnalytics.subjectDifficulty.slice(0, 4).map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-28 truncate">{s.subject}</span>
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.difficulty === 'easy' ? 'bg-emerald-500' : s.difficulty === 'moderate' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.round(s.avgNumeric * 100)}%` }} />
                        </div>
                        <span className={`text-[8px] font-black uppercase w-14 text-right ${s.difficulty === 'easy' ? 'text-emerald-400' : s.difficulty === 'moderate' ? 'text-amber-400' : 'text-rose-400'}`}>{s.difficulty}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* RCCIC insight snippet */}
                {classAnalytics.classInsight && (
                  <div className="flex items-start gap-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl px-4 py-3">
                    <Brain className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">{classAnalytics.classInsight}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center text-slate-600 text-[11px] font-black uppercase tracking-widest">
                No class analytics yet — select an event.
              </div>
            )}

            {/* Right: Grade Distribution + AI Advisor */}
            <div className="space-y-4">
              {/* Grade Distribution Chart — compact fixed height */}
              <div>
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.25em] mb-3">Grade Distribution</p>
                <div className="bg-black/30 rounded-2xl border border-white/5 p-4 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="grade" stroke="#818cf8" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                      <YAxis stroke="#818cf8" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} width={20} />
                      <Tooltip
                        cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                        contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '16px', padding: '10px' }}
                        itemStyle={{ color: '#818cf8', fontWeight: '900', fontSize: '10px' }}
                      />
                      <Bar dataKey="count" fill="url(#helixGradient2)" radius={[6, 6, 6, 6]} barSize={20} />
                      <defs>
                        <linearGradient id="helixGradient2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#c084fc" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI Tactical Advisor — compact inline */}
              <div className="bg-indigo-950/30 border border-indigo-500/15 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.25em]">Tactical Advisor</span>
                  </div>
                  <Button
                    onClick={generateClassInsight}
                    disabled={generatingInsight || results.length === 0}
                    className="h-7 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest text-[8px] gap-1.5 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-40"
                  >
                    {generatingInsight ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {generatingInsight ? "Analyzing..." : "Generate"}
                  </Button>
                </div>
                {aiInsight ? (
                  <p className="text-[11px] text-slate-300 leading-relaxed italic line-clamp-4">"{aiInsight}"</p>
                ) : (
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center py-2">
                    Deploy intelligence to unlock tactical insights.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>{/* End Intelligence Hub */}

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 opacity-60" />
          <input 
            type="text"
            placeholder="Search Student..."
            value={searchName}
            onChange={(e) => { setSearchName(e.target.value); setPage(0); }}
            className="w-full bg-black/20 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 opacity-60" />
          <input 
            type="text"
            placeholder="Filter Class..."
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setPage(0); }}
            className="w-full bg-black/20 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>
        <div className="relative">
          <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 opacity-60" />
          <input 
            type="date"
            value={searchDate}
            onChange={(e) => { setSearchDate(e.target.value); setPage(0); }}
            className="w-full bg-black/20 border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center gap-3">
           <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest whitespace-nowrap">Show:</span>
           <select 
             value={pageSize}
             onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
             className="flex-1 bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
           >
             <option value={6} className="bg-slate-900">6 Cards</option>
             <option value={12} className="bg-slate-900">12 Cards</option>
             <option value={24} className="bg-slate-900">24 Cards</option>
           </select>
        </div>
      </div>

      {/* Results Matrix */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-16 h-16 text-indigo-500 animate-spin opacity-20" />
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] animate-pulse">Syncing with Results Core...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-32 bg-white/5 rounded-[4rem] border-2 border-dashed border-white/10">
           <Trophy className="w-24 h-24 text-slate-800 mx-auto mb-8 opacity-20" />
           <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-sm">No entities found in current calibration.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
          {results.map((res) => {
            const growth = res.metrics?.improvementDelta || 0;
            const velocity = res.metrics?.improvementVelocity || 0;
            const consistency = res.metrics?.subjectConsistency || 0;
            const submittedTime = res.submitted_at ? new Date(res.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
            
            return (
              <div key={res.id} className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 hover:border-indigo-500/40 transition-all duration-700 group relative overflow-hidden backdrop-blur-xl flex flex-col max-h-[420px] shadow-xl hover:shadow-indigo-500/10">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
                 
                 {/* 1. Header Zone */}
                 <div className="flex justify-between items-start mb-6 shrink-0">
                    <div className="space-y-1">
                        <h4 className="font-black text-white text-xl tracking-tighter uppercase group-hover:text-indigo-400 transition-colors leading-tight truncate max-w-[180px]">
                           {res.profiles?.full_name}
                        </h4>
                        <div className="flex flex-col gap-0.5">
                           <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest opacity-60">
                              {res.event_name}
                           </p>
                           <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest opacity-60">
                              {res.profiles?.admission_number} â€¢ {res.profiles?.form_class}
                           </p>
                           <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                              Submitted: {submittedTime}
                           </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="px-5 py-3 bg-indigo-500 rounded-2xl text-2xl font-black text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-500">
                           {res.overall_grade}
                        </div>
                    </div>
                 </div>

                 {/* 2. Academic Summary Block */}
                 <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-center">
                       <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Baseline Trend</span>
                       <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white/40">{res.previous_overall_grade || 'E'}</span>
                          <ChevronRight className="w-3 h-3 text-slate-700" />
                          <div className={`flex items-center gap-1 text-sm font-black ${velocity > 0 ? 'text-emerald-400' : velocity < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                             {velocity > 0 ? <TrendingUp className="w-4 h-4" /> : velocity < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                             {(velocity * 100).toFixed(0)}%
                          </div>
                       </div>
                    </div>
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex flex-col justify-center">
                       <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-1">AI Trajectory</span>
                       <p className="text-[10px] text-slate-300 font-medium leading-tight italic line-clamp-2">
                          "{res.narrative || "Calibrating..."}"
                       </p>
                    </div>
                 </div>

                 {/* 3. Consolidated Subject Matrix (Grid for Clarity) */}
                 <div className="bg-black/40 rounded-[2rem] border border-white/10 overflow-hidden flex-1 min-h-0 flex flex-col mb-4">
                    <div className="px-6 py-3 border-b border-white/5 bg-white/5 shrink-0 flex justify-between items-center">
                        <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Library className="w-3 h-3" />
                          Module Matrix
                        </h5>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] font-black text-slate-500 uppercase">{res.subjects.length} Units</span>
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar flex-1 max-h-[180px]">
                      {res.subjects.map((s: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl transition-all hover:bg-white/10 group/sub">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[80px]">{s.name}</span>
                           <span className="text-[10px] font-black text-indigo-400">{s.grade}</span>
                        </div>
                      ))}
                    </div>
                 </div>

                 {/* Action Bar */}
                 <div className="flex items-center gap-3 shrink-0 pt-2 border-t border-white/5">
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                        <select 
                          value={sharingWith}
                          onChange={(e) => setSharingWith(e.target.value)}
                          className="w-full bg-transparent text-[9px] font-black text-slate-400 outline-none uppercase tracking-widest appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-900">Transmit Report...</option>
                          {otherTeachers.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.full_name}</option>)}
                        </select>
                    </div>
                    <Button 
                      onClick={() => handleShare(res.student_id)}
                      className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg p-0 transition-transform active:scale-90"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-black/40">
                <th className="px-10 py-6 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Student Entity</th>
                <th className="px-10 py-6 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Class</th>
                <th className="px-10 py-6 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] text-center">Core Grade</th>
                <th className="px-10 py-6 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Time Vector</th>
                <th className="px-10 py-6 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] text-right">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.map((res) => (
                <tr key={res.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                           <Users className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                           <div className="font-black text-white text-lg tracking-tight uppercase group-hover:text-indigo-400 transition-colors">{res.profiles?.full_name}</div>
                           <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{res.profiles?.admission_number}</div>
                        </div>
                      </div>
                  </td>
                  <td className="px-10 py-8">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{res.profiles?.form_class}</span>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <span className="inline-block px-8 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-black text-xl shadow-inner">
                      {res.overall_grade}
                    </span>
                  </td>
                  <td className="px-10 py-8">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                       {res.submitted_at ? new Date(res.submitted_at).toLocaleString() : 'N/A'}
                     </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <Button variant="ghost" className="h-12 px-8 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/5 font-black uppercase tracking-[0.2em] text-[10px] gap-2">
                       Analyze <ChevronRight className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && results.length > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
            Showing <span className="text-indigo-400">{page * pageSize + 1}</span> to <span className="text-indigo-400">{Math.min((page + 1) * pageSize, totalCount)}</span> of <span className="text-indigo-400">{totalCount}</span> student entities
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="h-12 px-6 rounded-xl bg-white/5 border-white/10 text-xs font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-30"
            >
              Previous
            </Button>

            <div className="flex gap-2">
              {[...Array(Math.min(5, Math.ceil(totalCount / pageSize)))].map((_, i) => {
                const pageNum = i; // Simplified for now, can be improved for many pages
                return (
                  <Button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    className={`h-12 w-12 rounded-xl text-xs font-black transition-all ${page === pageNum ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              {Math.ceil(totalCount / pageSize) > 5 && (
                <span className="h-12 w-12 flex items-center justify-center text-slate-600 font-bold">...</span>
              )}
            </div>

            <Button
              variant="outline"
              disabled={(page + 1) * pageSize >= totalCount}
              onClick={() => setPage(page + 1)}
              className="h-12 px-6 rounded-xl bg-white/5 border-white/10 text-xs font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-30"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
