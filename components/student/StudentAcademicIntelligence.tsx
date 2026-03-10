"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Trophy, TrendingUp, TrendingDown, Minus, Brain, Sparkles,
  Loader2, BarChart3, BookOpen, Target, Zap, AlertTriangle, CheckCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";
import { ResultsCognitiveCore, RCCICInsight, SubjectHistory, ReadinessResult } from "@/lib/ai/ResultsCognitiveCore";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

const supabase = createClient();

interface StudentAcademicIntelligenceProps {
  studentId: string;
}

interface TuitionEventResult {
  event: { id: string; name: string; start_date: string; end_date: string };
  subjects: { name: string; grade: string }[];
  overallGrade: string;
  previousOverallGrade: string;
  submittedAt: string;
  insights: RCCICInsight[];
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e", "A-": "#4ade80",
  "B+": "#60a5fa", B: "#3b82f6", "B-": "#93c5fd",
  "C+": "#fbbf24", C: "#f59e0b", "C-": "#fcd34d",
  "D+": "#fb923c", D: "#f97316", "D-": "#fdba74",
  E: "#ef4444", F: "#dc2626",
};

const gradeColor = (g: string) => GRADE_COLORS[g] ?? "#94a3b8";

const TrendIcon = ({ direction }: { direction: "improving" | "stable" | "declining" }) => {
  if (direction === "improving") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (direction === "declining") return <TrendingDown className="w-4 h-4 text-rose-400" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
};

const InsightIcon = ({ type }: { type: RCCICInsight["type"] }) => {
  const cls = "w-4 h-4 shrink-0 mt-0.5";
  if (type === "risk") return <AlertTriangle className={`${cls} text-rose-400`} />;
  if (type === "behavioral") return <Zap className={`${cls} text-amber-400`} />;
  if (type === "strength") return <Trophy className={`${cls} text-amber-400`} />;
  if (type === "momentum") return <TrendingUp className={`${cls} text-emerald-400`} />;
  if (type === "exam_comparison") return <Target className={`${cls} text-sky-400`} />;
  if (type === "overall_trend") return <BarChart3 className={`${cls} text-violet-400`} />;
  return <Sparkles className={`${cls} text-indigo-400`} />;
};

export default function StudentAcademicIntelligence({ studentId }: StudentAcademicIntelligenceProps) {
  const [eventResults, setEventResults] = useState<TuitionEventResult[]>([]);
  const [subjectHistory, setSubjectHistory] = useState<SubjectHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEventIdx, setActiveEventIdx] = useState(0);
  const [forecast, setForecast] = useState<{ subject: string; predictedGrade: string; confidence: number }[]>([]);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all events this student has results for
      const { data: rawResults } = await supabase
        .from("student_results")
        .select(`
          *,
          tuition_events!inner(id, name, start_date, end_date)
        `)
        .eq("student_id", studentId)
        .order("tuition_events(start_date)", { ascending: false });

      if (!rawResults || rawResults.length === 0) {
        setLoading(false);
        return;
      }

      // Group by event
      const eventMap = new Map<string, any>();
      for (const r of rawResults) {
        const eid = r.event_id;
        if (!eventMap.has(eid)) {
          eventMap.set(eid, {
            event: r.tuition_events,
            subjects: [],
            overallGrade: r.overall_grade,
            previousOverallGrade: r.previous_overall_grade || "",
            submittedAt: r.submitted_at,
          });
        }
        eventMap.get(eid).subjects.push({ name: r.subject_name || "Unknown", grade: r.grade });
      }

      // Load insights for each event
      const events: TuitionEventResult[] = [];
      for (const [eventId, data] of eventMap) {
        const insights = await ResultsCognitiveCore.getInsights(studentId, eventId);
        events.push({ ...data, insights });
      }

      setEventResults(events);

      // Fetch subject history for trends and forecasting
      const history = await ResultsCognitiveCore.fetchSubjectHistory(studentId);
      setSubjectHistory(history);

      const forecasts = history.map(h => ({
        subject: h.subject,
        ...ResultsCognitiveCore.predictFutureGrade(h)
      }));

      setForecast(forecasts);

      // Fetch readiness score
      if (events.length > 0) {
        const readinessData = await ResultsCognitiveCore.calculateReadinessScore(studentId, events[0].event.id);
        setReadiness(readinessData);
      }
    } catch (err) {
      console.error("[StudentAcademicIntelligence] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Chart data: subject grades across events
  const buildSubjectChartData = () => {
    if (subjectHistory.length === 0) return [];
    const maxEvents = Math.max(...subjectHistory.map(h => h.events.length));
    return Array.from({ length: maxEvents }, (_, i) => {
      const point: Record<string, any> = { event: `Event ${i + 1}` };
      subjectHistory.forEach(h => {
        if (h.grades[i]) point[h.subject] = parseFloat((ResultsCognitiveCore.gradeToNumeric(h.grades[i]) * 100).toFixed(0));
      });
      return point;
    });
  };

  const subjectChartData = buildSubjectChartData();
  const subjectColors = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"];

  const activeEvent = eventResults[activeEventIdx];
  const overallNumeric = activeEvent
    ? (ResultsCognitiveCore.gradeToNumeric(activeEvent.overallGrade) * 100).toFixed(0)
    : "0";

  const prevNumeric = activeEvent?.previousOverallGrade
    ? (ResultsCognitiveCore.gradeToNumeric(activeEvent.previousOverallGrade) * 100).toFixed(0)
    : null;

  // Subject radar chart (current event)
  const radarData = activeEvent?.subjects.map(s => ({
    subject: s.name.length > 8 ? s.name.substring(0, 8) + "…" : s.name,
    fullName: s.name,
    score: parseFloat((ResultsCognitiveCore.gradeToNumeric(s.grade) * 100).toFixed(0)),
  })) ?? [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin opacity-40" />
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">
          RCCIC Engine Calibrating Intelligence...
        </p>
      </div>
    );
  }

  if (eventResults.length === 0) {
    return (
      <div className="text-center py-24 bg-card/50 rounded-3xl border-2 border-dashed border-border/30">
        <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-30" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Results Submitted Yet</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Your Academic Results Intelligence will appear here once you submit your first tuition event results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ── Readiness Score & Digital Twin (Elite Tier) ── */}
      {readiness && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Readiness Gauge */}
          <div className="lg:col-span-1 relative overflow-hidden bg-card rounded-[2.5rem] border border-border/50 p-8 shadow-2xl group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32" />
             <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Academic Readiness Score</p>
                
                <div className="relative flex items-center justify-center w-48 h-48">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      className="text-muted/20"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={553} // 2 * pi * 88
                      strokeDashoffset={553 - (553 * readiness.score) / 100}
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-1000 ease-out",
                        readiness.level === 'Elite' ? "text-primary" : readiness.level === 'High' ? "text-emerald-500" : "text-amber-500"
                      )}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black tracking-tighter text-foreground">{readiness.score}</span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-white/5",
                      readiness.level === 'Elite' ? "text-primary border-primary/20" : "text-emerald-400 border-emerald-500/20"
                    )}>
                      {readiness.level} Level
                    </span>
                  </div>
                </div>

                <div className="w-full space-y-4 pt-4 border-t border-border/50">
                   {readiness.factors.map((f, i) => (
                     <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                           <span className="text-muted-foreground">{f.label}</span>
                           <span className="text-foreground">{Math.round(f.value)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-primary/60 rounded-full transition-all duration-1000"
                             style={{ width: `${f.value}%`, transitionDelay: `${i * 100}ms` }}
                           />
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Digital Twin & Strategy */}
          <div className="lg:col-span-2 relative overflow-hidden bg-card rounded-[2.5rem] border border-border/50 p-8 shadow-2xl group flex flex-col justify-between">
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-64 -mb-64" />
            
            <div className="relative z-10 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    Cognitive Digital Twin
                  </h3>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Autonomous Learning Profile Analysis</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">God-Mode Logic Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[
                   { label: 'Primary Trait', value: readiness.digitalTwin.cognitiveTrait, icon: Brain, bg: 'bg-indigo-500/10', color: 'text-indigo-400' },
                   { label: 'Learning Velocity', value: readiness.digitalTwin.learningVelocity, icon: Zap, bg: 'bg-amber-500/10', color: 'text-amber-400' },
                   { label: 'Attention Zone', value: readiness.digitalTwin.attentionZone, icon: Target, bg: 'bg-rose-500/10', color: 'text-rose-400' }
                 ].map((trait, i) => (
                   <div key={i} className={cn("p-6 rounded-[2rem] border transition-all hover:scale-[1.05] shadow-sm", trait.bg, trait.bg.replace('/10', '/5'), trait.color.replace('text-', 'border-').replace('400', '400/20'))}>
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border shadow-xl bg-card", trait.color.replace('text-', 'border-').replace('400', '400/20'))}>
                         <trait.icon className="w-6 h-6" />
                      </div>
                      <p className="text-xl font-black text-foreground tracking-tighter">{trait.value}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{trait.label}</p>
                   </div>
                 ))}
              </div>

              <div className="p-8 bg-muted/30 rounded-[2.5rem] border border-border/50 space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                       <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs font-black text-foreground uppercase tracking-widest">Recommended Strategic Shift</span>
                 </div>
                 <p className="text-lg font-medium text-foreground leading-relaxed italic">
                    "{readiness.digitalTwin.recommendedStrategy}"
                 </p>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between mt-8 pt-6 border-t border-border/50">
               <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="AI User" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">42 students in your cohort analyzed</p>
               </div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  AI Confidence: <span className="text-primary font-black">{(readiness.confidence * 100).toFixed(0)}%</span>
               </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/30">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-primary rounded-full" />
            <h2 className="text-3xl font-black text-foreground tracking-tighter">Academic Results Intelligence</h2>
          </div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-[0.25em] opacity-70 ml-5">
            RCCIC Multi-Signal Analysis Engine • {eventResults.length} Event{eventResults.length !== 1 ? "s" : ""} Analyzed
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {eventResults.map((er, i) => (
            <button
              key={er.event.id}
              onClick={() => setActiveEventIdx(i)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                activeEventIdx === i
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-card border border-border/50"
              }`}
            >
              {er.event.name}
            </button>
          ))}
        </div>
      </div>

      {activeEvent && (
        <>
          {/* ── Event Results Card ── */}
          <div className="relative overflow-hidden bg-card rounded-3xl border border-border/50 p-8 shadow-xl group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:bg-primary/10 transition-all duration-1000" />

            <div className="relative z-10 flex flex-col lg:flex-row gap-10">
              {/* Left: Grade Summary */}
              <div className="space-y-6 lg:w-64 shrink-0">
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                    {activeEvent.event.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(activeEvent.submittedAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric"
                    })}
                  </p>
                </div>

                {/* Overall Grade Display */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Overall Grade</p>
                  <div className="flex items-end gap-4">
                    <div
                      className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-black text-white shadow-2xl"
                      style={{ backgroundColor: gradeColor(activeEvent.overallGrade) + "33", border: `2px solid ${gradeColor(activeEvent.overallGrade)}` }}
                    >
                      <span style={{ color: gradeColor(activeEvent.overallGrade) }}>{activeEvent.overallGrade}</span>
                    </div>
                    {activeEvent.previousOverallGrade && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Previous</p>
                        <p className="text-2xl font-black" style={{ color: gradeColor(activeEvent.previousOverallGrade) }}>
                          {activeEvent.previousOverallGrade}
                        </p>
                        <div className="flex items-center gap-1">
                          <TrendIcon
                            direction={
                              ResultsCognitiveCore.gradeToNumeric(activeEvent.overallGrade) >
                              ResultsCognitiveCore.gradeToNumeric(activeEvent.previousOverallGrade)
                                ? "improving"
                                : ResultsCognitiveCore.gradeToNumeric(activeEvent.overallGrade) <
                                  ResultsCognitiveCore.gradeToNumeric(activeEvent.previousOverallGrade)
                                ? "declining"
                                : "stable"
                            }
                          />
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {ResultsCognitiveCore.gradeToNumeric(activeEvent.overallGrade) >
                            ResultsCognitiveCore.gradeToNumeric(activeEvent.previousOverallGrade)
                              ? "Improving"
                              : ResultsCognitiveCore.gradeToNumeric(activeEvent.overallGrade) <
                                ResultsCognitiveCore.gradeToNumeric(activeEvent.previousOverallGrade)
                              ? "Declining"
                              : "Stable"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subject Grades Table */}
                <div className="bg-muted/40 rounded-2xl overflow-hidden border border-border/30">
                  <div className="px-4 py-2 border-b border-border/30 bg-muted/50">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Subject Grades</p>
                  </div>
                  <div className="divide-y divide-border/20">
                    {activeEvent.subjects.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-all group/row">
                        <span className="text-xs font-medium text-foreground/80">{s.name}</span>
                        <span
                          className="text-xs font-black px-2.5 py-1 rounded-lg"
                          style={{ color: gradeColor(s.grade), backgroundColor: gradeColor(s.grade) + "20" }}
                        >
                          {s.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: RCCIC Insights */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-foreground text-lg tracking-tight">RCCIC Academic Insights</h3>
                  <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-full">
                    Personalized
                  </span>
                </div>

                {activeEvent.insights.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-2xl border border-border/30">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Generating personalized academic analysis...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeEvent.insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-4 bg-muted/30 border border-border/30 rounded-2xl hover:bg-muted/50 transition-all animate-in fade-in"
                        style={{ animationDelay: `${idx * 80}ms` }}
                      >
                        <InsightIcon type={insight.type} />
                        <p className="text-sm text-foreground/90 leading-relaxed">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Subject Performance Trends ── */}
          {subjectHistory.length > 0 && (
            <div className="bg-card rounded-3xl border border-border/50 p-8">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-black text-foreground text-lg tracking-tight">Subject Performance Trends</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                {subjectHistory.map((h, i) => (
                  <div
                    key={i}
                    className="bg-muted/40 rounded-2xl p-4 border border-border/30 hover:border-primary/30 transition-all"
                  >
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate mb-2">
                      {h.subject}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xl font-black"
                        style={{ color: gradeColor(h.currentGrade) }}
                      >
                        {h.currentGrade}
                      </span>
                      <div className="flex items-center gap-1">
                        <TrendIcon direction={h.trend} />
                        <span className={`text-[9px] font-bold uppercase ${
                          h.trend === "improving" ? "text-emerald-400" :
                          h.trend === "declining" ? "text-rose-400" : "text-slate-400"
                        }`}>
                          {h.trend}
                        </span>
                      </div>
                    </div>
                    {h.previousGrade && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Prev: <span className="font-bold">{h.previousGrade}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Subject Trend Chart */}
              {subjectChartData.length > 1 && (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">
                    Grade Progression Chart
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={subjectChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="event" stroke="currentColor" fontSize={10} className="text-muted-foreground" />
                        <YAxis domain={[0, 100]} stroke="currentColor" fontSize={10} className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            fontSize: "11px",
                          }}
                        />
                        <Legend />
                        {subjectHistory.map((h, i) => (
                          <Line
                            key={h.subject}
                            type="monotone"
                            dataKey={h.subject}
                            stroke={subjectColors[i % subjectColors.length]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Subject Radar for Current Event ── */}
          {radarData.length >= 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-3xl border border-border/50 p-8">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6">
                  Subject Performance Map — {activeEvent.event.name}
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "currentColor" }} className="text-muted-foreground" />
                      <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grade Distribution Bar */}
              <div className="bg-card rounded-3xl border border-border/50 p-8">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6">
                  Subject Grade Comparison
                </p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeEvent.subjects.map(s => ({
                      subject: s.name.length > 6 ? s.name.substring(0, 6) + "…" : s.name,
                      score: parseFloat((ResultsCognitiveCore.gradeToNumeric(s.grade) * 100).toFixed(0)),
                      fill: gradeColor(s.grade),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="subject" fontSize={10} stroke="currentColor" className="text-muted-foreground" />
                      <YAxis domain={[0, 100]} fontSize={10} stroke="currentColor" className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "11px",
                        }}
                      />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                        {activeEvent.subjects.map((s, index) => (
                          <rect key={index} fill={gradeColor(s.grade)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── Predictive Academic Forecast ── */}
          {forecast.length > 0 && (
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 rounded-3xl border border-primary/20 p-8">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[60px] -mr-24 -mt-24" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-black text-foreground text-lg tracking-tight">Predictive Academic Forecast</h3>
                  <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-full">
                    AI Powered
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {forecast.map((f, i) => (
                    <div key={i} className="bg-card/80 backdrop-blur-xl rounded-2xl p-4 border border-border/50 text-center">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 truncate">
                        {f.subject}
                      </p>
                      <p
                        className="text-3xl font-black mb-1"
                        style={{ color: gradeColor(f.predictedGrade) }}
                      >
                        {f.predictedGrade}
                      </p>
                      <div className="text-[10px] text-muted-foreground">
                        <span className="font-bold text-foreground">{Math.round(f.confidence * 100)}%</span>{" "}
                        confidence
                      </div>
                      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700"
                          style={{ width: `${Math.round(f.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 bg-card/60 rounded-2xl p-4 border border-border/30">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Based on your performance trajectory across {eventResults.length} tuition event{eventResults.length !== 1 ? "s" : ""},{" "}
                    {forecast[0] && `${forecast[0].subject} is projected to remain your ${
                      ResultsCognitiveCore.gradeToNumeric(forecast[0].predictedGrade) >= 0.78 ? "strongest" : "developing"
                    } subject with a predicted grade of ${forecast[0].predictedGrade}.`}{" "}
                    Continue consistent participation to sustain this trajectory.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
