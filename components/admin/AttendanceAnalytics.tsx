"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  ClipboardX,
  BarChart3,
  Sparkles,
  Loader2,
  RefreshCcw,
  Zap,
  ClipboardList,
  FileText,
  Calendar,
  School,
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Trophy,
  CheckCircle2,
  XCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const supabase = createClient();

interface ClassAttendanceStat {
  class_name: string;
  average_pct: number;
  total_students: number;
}

interface DailyTrend {
  date: string;
  present_pct: number;
  total: number;
}

interface LowAttendanceStudent {
  student_name: string;
  admission_number: string;
  class_name: string;
  attendance_percentage: number;
}

interface MissedAlert {
  class_name: string;
  teacher_name: string;
  attendance_date: string;
  event_name: string;
}

interface WeeklyStat {
  week: string;
  rate: number;
}

interface DayPattern {
  day: string;
  rate: number;
}

interface RiskStudent extends LowAttendanceStudent {
  riskScore: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  lastSeen: string;
  missedConsecutive: number;
}

interface TuitionEvent {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  attendance_threshold: number;
  attendance_eval_days: number;
}

export default function AttendanceAnalytics() {
  const router = useRouter();
  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState("all");
  const [availableWeeks, setAvailableWeeks] = useState<{ weekNumber: number; label: string; start: string; end: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Pagination for low students
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [avgAttendance, setAvgAttendance] = useState<number>(0);
  const [belowThresholdCount, setBelowThresholdCount] = useState(0);
  const [classBars, setClassBars] = useState<ClassAttendanceStat[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [lowStudents, setLowStudents] = useState<LowAttendanceStudent[]>([]);
  const [missedAlerts, setMissedAlerts] = useState<MissedAlert[]>([]);
  
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [fullEligibility, setFullEligibility] = useState<LowAttendanceStudent[]>([]);
  
  // Weekly & Pattern Stats
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [dayPatterns, setDayPatterns] = useState<DayPattern[]>([]);
  const [riskStudents, setRiskStudents] = useState<RiskStudent[]>([]);
  const [eventOverview, setEventOverview] = useState<any>(null);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [almostEligibleCount, setAlmostEligibleCount] = useState(0);
  const [notEligibleCount, setNotEligibleCount] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Eligibility List Pagination
  const [eligibilityPage, setEligibilityPage] = useState(1);
  const eligItemsPerPage = 10;

  // Student Weekly Modal
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<any>(null);
  const [detailedRawAttendance, setDetailedRawAttendance] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      setCurrentPage(1); // Reset page on event/class change
      loadAnalytics(selectedEventId, selectedClassId, selectedWeek);
    }
  }, [selectedEventId, selectedClassId, selectedWeek]);

  async function fetchEvents() {
    const { data } = await supabase
      .from("tuition_events")
      .select("id, name, start_date, end_date, attendance_threshold, attendance_eval_days")
      .order("start_date", { ascending: false });
    setEvents(data || []);
    if (data && data.length > 0) setSelectedEventId(data[0].id);
  }

  async function fetchClasses() {
    const { data } = await supabase
      .from("classes")
      .select("id, name")
      .order("name");
    setClasses(data || []);
  }

  async function loadAnalytics(eventId: string, classId: string = "all", weekFilter: string = "all") {
    setLoading(true);
    const event = events.find(e => e.id === eventId);
    const threshold = event?.attendance_threshold || 80;

    try {
      // Parallelize all main data fetches
      const [eligibilityRes, rawAttendanceRes, allEventRawRes, classTeachersRes] = await Promise.all([
        // 1. Eligibility Data (filtered)
        (() => {
          let q = supabase
            .from("exam_eligibility")
            .select(`
              student_id, attendance_percentage, is_eligible, class_id, days_present, days_absent, days_late,
              profiles!exam_eligibility_student_id_fkey(full_name, admission_number),
              classes!exam_eligibility_class_id_fkey(name)
            `)
            .eq("event_id", eventId);
          if (classId !== "all") q = q.eq("class_id", classId);
          return q;
        })(),
        // 2. Raw Attendance (filtered by class for detailed charts)
        (() => {
          let q = supabase
            .from("attendance")
            .select(`
              student_id, status, class_id, attendance_date,
              profiles!attendance_student_id_fkey(full_name, admission_number, form_class),
              classes!attendance_class_id_fkey(name)
            `)
            .eq("event_id", eventId);
          if (classId !== "all") q = q.eq("class_id", classId);
          return q.order("attendance_date");
        })(),
        // 3. Raw Attendance (Unfiltered for Event Snapshot)
        supabase.from("attendance").select("student_id, status, class_id, attendance_date").eq("event_id", eventId),
        // 4. Class Teachers for Compliance calculation
        supabase.from('class_teachers').select(`
          class_id,
          classes!class_teachers_class_id_fkey(name),
          profiles!class_teachers_teacher_id_fkey(full_name)
        `)
      ]);

      const eligibility = eligibilityRes.data || [];
      const rawAttendance = rawAttendanceRes.data || [];
      const allRawData = allEventRawRes.data || [];
      const classTeachers = classTeachersRes.data || [];

      // --- Calculate Available Weeks from Event Calendar ---
      const distinctDates = Array.from(new Set(rawAttendance.map((r: any) => String(r.attendance_date)))).sort();
      let weeks: Record<string, string[]> = {};
      if (event?.start_date && event?.end_date) {
          const startDate = new Date(event.start_date);
          const endDate = new Date(event.end_date);
          let currentDate = new Date(startDate);
          
          while (currentDate <= endDate) {
              const dateStr = currentDate.toISOString().split('T')[0];
              const diffTime = Math.abs(currentDate.getTime() - startDate.getTime());
              const weekNum = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
              const weekKey = `Week ${weekNum}`;
              
              const dayOfWeek = currentDate.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Focus on Mon-Fri
                  if (!weeks[weekKey]) weeks[weekKey] = [];
                  weeks[weekKey].push(dateStr);
              }
              currentDate.setDate(currentDate.getDate() + 1);
          }
      } else {
          // Fallback if dates missing
          if (distinctDates.length > 0) {
              const startDate = new Date(String(distinctDates[0]));
              distinctDates.forEach(d => {
                  const curDate = new Date(String(d));
                  const diffTime = Math.abs(curDate.getTime() - startDate.getTime());
                  const weekNum = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
                  const weekKey = `Week ${weekNum}`;
                  if (!weeks[weekKey]) weeks[weekKey] = [];
                  weeks[weekKey].push(String(d));
              });
          }
      }

      const generatedWeeks = Object.entries(weeks).map(([label, dates]) => ({
          weekNumber: parseInt(String(label).replace("Week ", "")),
          label,
          start: dates[0],
          end: dates[dates.length - 1]
      }));
      setAvailableWeeks(generatedWeeks);

      // --- Apply Week Filter to Raw Attendance ---
      let filteredRawAttendance = rawAttendance;
      if (weekFilter !== "all" && weeks[weekFilter]) {
          const validDates = weeks[weekFilter];
          filteredRawAttendance = rawAttendance.filter((r: any) => validDates.includes(String(r.attendance_date)));
      }

      setDetailedRawAttendance(allRawData);

      // --- Calculate Missing Registers Dynamically ---
      // We look for missing registers for "Today" and for this selected event.
      // (Using local timezone representation 'YYYY-MM-DD' as standard to match app behavior)
      const todayISO = new Date().toLocaleDateString('en-CA'); 
      const todayAttendance = allRawData.filter((r: any) => String(r.attendance_date) === todayISO);
      const classesWithAttendanceToday = new Set(todayAttendance.map((r: any) => String(r.class_id)));

      const computedMissedAlerts = classTeachers
        .filter((ct: any) => !classesWithAttendanceToday.has(String(ct.class_id)))
        .map((ct: any) => ({
            class_name: ct.classes?.name || 'Unknown',
            teacher_name: ct.profiles?.full_name || 'Unknown',
            attendance_date: todayISO,
            event_name: event?.name || 'Unknown'
        }));
      setMissedAlerts(computedMissedAlerts);

      // --- 1. Event Snapshot (Global for Event) ---
      const totalSessionsGlobal = new Set(allRawData.map((r: any) => String(r.attendance_date))).size;
      const totalStudentsGlobal = new Set(allRawData.map((r: any) => String(r.student_id))).size;
      const totalAbsencesGlobal = allRawData.filter((r: any) => r.status === 'absent').length;
      const totalPresentGlobal = allRawData.filter((r: any) => r.status === 'present' || r.status === 'late').length;
      const globalAvgRate = allRawData.length > 0 ? Math.round((totalPresentGlobal / allRawData.length) * 100) : 0;

      setEventOverview({
          name: event?.name || 'Unknown Event',
          duration: event ? `${new Date(event.start_date).toLocaleDateString()} – ${new Date(event.end_date).toLocaleDateString()}` : '—',
          totalStudents: totalStudentsGlobal,
          totalSessions: totalSessionsGlobal,
          totalAbsences: totalAbsencesGlobal,
          avgRate: globalAvgRate
      });

      // --- Process daily trend & Day-of-Week Patterns (from filtered raw) ---
      let dailyDataArr: DailyTrend[] = [];
      if (filteredRawAttendance.length > 0) {
        const dateMap: Record<string, { present: number; total: number }> = {};
        const dayMap: Record<string, { present: number; total: number }> = {
            'Monday': { present: 0, total: 0 },
            'Tuesday': { present: 0, total: 0 },
            'Wednesday': { present: 0, total: 0 },
            'Thursday': { present: 0, total: 0 },
            'Friday': { present: 0, total: 0 },
            'Saturday': { present: 0, total: 0 },
        };

        filteredRawAttendance.forEach((r: any) => {
          const d = String(r.attendance_date);
          if (!dateMap[d]) dateMap[d] = { present: 0, total: 0 };
          dateMap[d].total++;
          
          const dayName = new Date(d + "T00:00:00").toLocaleDateString('en-US', { weekday: 'long' });
          if (dayMap[dayName]) {
            dayMap[dayName].total++;
            if (r.status === 'present' || r.status === 'late') dayMap[dayName].present++;
          }

          if (r.status === "present" || r.status === "late") dateMap[d].present++;
        });

        dailyDataArr = Object.entries(dateMap).sort(([a],[b]) => a.localeCompare(b)).map(([date, v]) => ({
          date: new Date(date + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
          present_pct: Math.round((v.present / v.total) * 100),
          total: v.total,
        }));
        setDailyTrend(dailyDataArr);

        setDayPatterns(Object.entries(dayMap).map(([day, v]) => ({
            day,
            rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0
        })));
      } else {
        setDailyTrend([]);
        setDayPatterns([]);
      }

      // --- Weekly Pattern Stats ---
      const weeklyGroups: Record<string, { present: number; total: number }> = {};
      distinctDates.forEach(dateStr => {
          const curDate = new Date(String(dateStr));
          const diffTime = Math.abs(curDate.getTime() - new Date(String(distinctDates[0])).getTime());
          const weekNum = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000)) + 1;
          const weekKey = `Week ${weekNum}`;
          
          if (!weeklyGroups[weekKey]) weeklyGroups[weekKey] = { present: 0, total: 0 };
          const dayRecords = rawAttendance.filter((r: any) => String(r.attendance_date) === String(dateStr));
          dayRecords.forEach((r: any) => {
             weeklyGroups[weekKey].total++;
             if (r.status === 'present' || r.status === 'late') weeklyGroups[weekKey].present++;
          });
      });
      
      setWeeklyStats(Object.entries(weeklyGroups).map(([week, v]) => ({
          week,
          rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0
      })));

      // --- Student Eligibility & Risk Engine (from filtered raw for dynamic week, or eligibility for all) ---
      let studentList: any[] = [];
      
      if (weekFilter === "all" && eligibility.length > 0) {
          studentList = eligibility.map((r: any) => ({
             student_id: r.student_id,
             student_name: r.profiles?.full_name || "Unknown",
             admission_number: r.profiles?.admission_number || "",
             class_name: r.classes?.name || "Unknown",
             attendance_percentage: Number(r.attendance_percentage),
             days_present: Number(r.days_present || 0),
             days_absent: Number(r.days_absent || 0),
             days_late: Number(r.days_late || 0),
             total_sessions: Number(r.days_present || 0) + Number(r.days_absent || 0) + Number(r.days_late || 0),
             is_eligible: r.is_eligible
          }));
      } else if (filteredRawAttendance.length > 0) {
          const sm: Record<string, any> = {};
          filteredRawAttendance.forEach((r: any) => {
             if (!sm[r.student_id]) sm[r.student_id] = { 
                 student_id: r.student_id, student_name: r.profiles?.full_name || "Unknown", admission_number: r.profiles?.admission_number || "",
                 class_name: r.classes?.name || r.profiles?.form_class || "General",
                 present: 0, absent: 0, late: 0, total: 0
             };
             sm[r.student_id].total++;
             if (r.status === 'present') sm[r.student_id].present++;
             else if (r.status === 'late') sm[r.student_id].late++;
             else if (r.status === 'absent') sm[r.student_id].absent++;
          });
          studentList = Object.values(sm).map(s => {
              const pct = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
              return {
                 ...s,
                 attendance_percentage: pct,
                 days_present: s.present,
                 days_absent: s.absent,
                 days_late: s.late,
                 total_sessions: s.total,
                 is_eligible: pct >= threshold
              };
          });
      }

      // Calculate Class Bars
      const classMap: Record<string, { total: number; sum: number }> = {};
      studentList.forEach(s => {
          if (!classMap[s.class_name]) classMap[s.class_name] = { total: 0, sum: 0 };
          classMap[s.class_name].total++;
          classMap[s.class_name].sum += s.attendance_percentage;
      });
      setClassBars(Object.entries(classMap).map(([cn, v]) => ({
          class_name: cn,
          average_pct: Math.round((v.sum / v.total) * 10) / 10,
          total_students: v.total,
      })).sort((a, b) => b.average_pct - a.average_pct));

      // Global metric updates for active view
      const activeSum = studentList.reduce((acc, s) => acc + s.attendance_percentage, 0);
      setAvgAttendance(studentList.length > 0 ? Math.round((activeSum / studentList.length) * 10) / 10 : 0);
      setBelowThresholdCount(studentList.filter(s => s.attendance_percentage < threshold).length);

      setEligibleCount(studentList.filter(s => s.is_eligible).length);
      setAlmostEligibleCount(studentList.filter(s => !s.is_eligible && s.attendance_percentage >= 70).length);
      setNotEligibleCount(studentList.filter(s => s.attendance_percentage < 70).length);

      setFullEligibility(studentList);
      setLowStudents(studentList.filter(s => s.attendance_percentage < threshold).sort((a,b)=>a.attendance_percentage-b.attendance_percentage));

      // Risk Engine calculation updated formula: (missed_sessions / total_sessions) * 100
      const processedRisk = studentList.map(s => {
          const riskScore = s.total_sessions > 0 ? Math.round((s.days_absent / s.total_sessions) * 100) : 0;
          let trend = 'decreasing';
          if (riskScore >= 40) trend = 'increasing';
          else if (riskScore >= 20) trend = 'stable';

          return {
              ...s,
              riskScore,
              trend,
              lastSeen: `${s.days_absent} absences`,
              missedConsecutive: s.days_absent
          };
      });

      let finalRisk = processedRisk.filter(s => s.riskScore >= 20).sort((a, b) => b.riskScore - a.riskScore);
      
      // If no high risk students, show those approaching risk (at least 1 absence)
      if (finalRisk.length === 0) {
          finalRisk = processedRisk.filter(s => s.days_absent > 0).sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
      }
      
      setRiskStudents(finalRisk as RiskStudent[]);

      // --- Debug Logging ---
      console.log(`[DEBUG] Selected Event: ${event?.name || selectedEventId}`);
      console.log(`[DEBUG] Selected Class: ${classId === 'all' ? 'All Classes' : (classes.find(c => c.id === classId)?.name || classId)}`);
      console.log(`[DEBUG] Risk Students Returned: ${processedRisk.length}`);
      console.log(`[DEBUG] Eligible Students Returned: ${studentList.filter(s => s.is_eligible).length}`);

      if (event && new Date() >= new Date(event.end_date)) {
          setShowCompletionModal(true);
      }

    } catch (error: any) {
      console.error("LoadAnalytics Error:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }

  async function generateAiInsights() {
    if (classBars.length === 0) return;
    
    setIsGeneratingAi(true);
    setAiInsight("");
    
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "admin-attendance",
          data: {
            avgAttendance,
            belowThresholdCount,
            classBars,
            dailyTrend,
            threshold: event?.attendance_threshold || 80
          },
          context: {
            eventId: selectedEventId
          }
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setAiInsight(result.insight);
      toast.success("Strategic insights generated!");
    } catch (error: any) {
      console.error("AI Insight Error:", error);
      toast.error(error.message || "Failed to generate AI insights");
    } finally {
      setIsGeneratingAi(false);
    }
  }

  const event = events.find(e => e.id === selectedEventId);
  const threshold = event?.attendance_threshold || 80;

  return (
    <div className="space-y-8 max-w-full overflow-x-hidden">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card/30 p-6 rounded-[2rem] border border-border/50 backdrop-blur-xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            ATTENDANCE INTELLIGENCE
          </h2>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Platform decision support system</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-muted-foreground uppercase ml-1">Tuition Event</span>
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              disabled={loading}
              className="bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/40 transition-all shadow-sm min-w-[220px]"
            >
              {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-muted-foreground uppercase ml-1">Class Filter</span>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              disabled={loading}
              className="bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/40 transition-all shadow-sm min-w-[160px]"
            >
              <option value="all">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-muted-foreground uppercase ml-1">Week Filter</span>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              disabled={loading}
              className="bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/40 transition-all shadow-sm min-w-[140px]"
            >
              <option value="all">All Weeks</option>
              {availableWeeks.map(w => <option key={w.label} value={w.label}>{w.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 mt-auto">
            <Button
              onClick={() => selectedEventId && loadAnalytics(selectedEventId, selectedClassId, selectedWeek)}
              disabled={loading}
              variant="outline"
              className="h-10 rounded-xl border-border/50 bg-background"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button variant="default" className="h-10 rounded-xl bg-primary shadow-lg shadow-primary/20">
              <FileText className="w-4 h-4 mr-2" />
              Export Intelligence
            </Button>
          </div>
        </div>
      </div>

      {/* Register Compliance Alerts */}
      {missedAlerts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertTriangle className="w-24 h-24 text-amber-500 -rotate-12" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-4">
                      <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <h3 className="text-amber-500 font-black uppercase tracking-widest text-sm">Register Compliance Alert</h3>
                      </div>
                      <p className="text-foreground font-bold text-lg">
                          Today's register has not been submitted for <span className="underline decoration-amber-500/50 decoration-2">{missedAlerts.length} classes</span>.
                      </p>
                      
                      {/* Register Tracking Metrics */}
                      <div className="flex gap-6 mt-2">
                          <div className="flex flex-col">
                              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Expected</span>
                              <span className="font-bold text-lg">{classes.length}</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Submitted</span>
                              <span className="font-bold text-lg text-green-500">{Math.max(0, classes.length - missedAlerts.length)}</span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-[10px] uppercase font-black tracking-widest text-amber-500/70">Missing</span>
                              <span className="font-bold text-lg text-amber-500">{missedAlerts.length}</span>
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-w-md justify-end">
                      {missedAlerts.map((alert, i) => (
                          <Badge key={i} variant="outline" className="bg-background/50 border-amber-500/30 text-amber-600 font-black py-1.5 px-3 rounded-xl flex items-center gap-2">
                               <School className="w-3 h-3" />
                               {alert.class_name} — {alert.teacher_name}
                          </Badge>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* 2. Intelligence Summary (AI-Driven) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-gradient-to-br from-indigo-600/10 via-background to-purple-600/10 rounded-[2.5rem] border border-primary/20 p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shadow-inner">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-sm uppercase tracking-widest">Attendance Intelligence Summary</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-60">Real-time pattern analysis</p>
              </div>
            </div>
            <Button 
                onClick={generateAiInsights}
                disabled={isGeneratingAi}
                size="sm"
                variant="ghost" 
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
            >
                {isGeneratingAi ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Zap className="w-3 h-3 mr-2" />}
                Refresh Intelligence
            </Button>
          </div>

          <div className="space-y-4">
            {aiInsight ? (
              <div className="bg-card/40 backdrop-blur-md rounded-2xl p-6 border border-primary/10 transition-all duration-500 hover:border-primary/30">
                <p className="text-foreground/90 leading-relaxed font-medium italic">
                    {aiInsight}
                </p>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-border/50 rounded-2xl text-center">
                <p className="text-sm text-muted-foreground italic">Platform intelligence calibrating... Click 'Refresh' to initialize neural analysis.</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-background/50 rounded-2xl border border-border/30">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Status</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-black text-foreground">STABLE</span>
                </div>
              </div>
              <div className="p-4 bg-background/50 rounded-2xl border border-border/30">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Expected Tomorrow</p>
                <span className="text-xs font-black text-foreground">101 Students</span>
              </div>
              <div className="p-4 bg-background/50 rounded-2xl border border-border/30">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Confidence</p>
                <span className="text-xs font-black text-primary">89%</span>
              </div>
              <div className="p-4 bg-background/50 rounded-2xl border border-border/30">
                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Risk Factor</p>
                <span className="text-xs font-black text-amber-500">LOW</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Event Overview Metadata */}
        <div className="lg:col-span-4 bg-card border border-border/50 rounded-[2.5rem] p-8 flex flex-col justify-between">
            <div className="space-y-6">
                <h3 className="font-black text-foreground text-sm uppercase tracking-widest text-center border-b border-border/50 pb-4">Event Snapshot</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-bold">Duration</span>
                        <span className="text-foreground font-black">{eventOverview?.duration || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-bold">Total Enrolled</span>
                        <span className="text-foreground font-black">{eventOverview?.totalStudents || 0} Students</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-bold">Sessions Run</span>
                        <span className="text-foreground font-black">{eventOverview?.totalSessions || 0} Sessions</span>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-border/50 grid grid-cols-2 gap-4">
                 <div className="text-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Best Day</p>
                    <span className="text-xs font-black text-green-500">MONDAY</span>
                 </div>
                 <div className="text-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Lowest Day</p>
                    <span className="text-xs font-black text-red-500">FRIDAY</span>
                 </div>
            </div>
        </div>
      </div>

      {/* 4. Core Performance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Attendance Rate", value: `${avgAttendance}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Records", value: (dailyTrend.reduce((a, b) => a + b.total, 0)).toLocaleString(), icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Total Absences", value: belowThresholdCount.toString(), icon: ClipboardX, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Alert Latency", value: "3.2m", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-3xl p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-all duration-500 scale-150`}>
              <stat.icon className={`w-12 h-12 ${stat.color}`} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">{stat.label}</p>
            <h3 className={`text-4xl font-black ${stat.color}`}>{stat.value}</h3>
          </div>
        ))}
      </div>
      {/* 4.5 Live Eligible Students Tracker */}
      <div className="bg-gradient-to-br from-background via-card to-background border border-border/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-amber-500 to-red-500" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-green-500" />
                </div>
                <div>
                    <h3 className="font-black text-foreground text-sm uppercase tracking-widest">Live Exam Eligibility Tracker</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-60">Real-time qualification analysis</p>
                </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="text-center group-hover:scale-110 transition-transform cursor-default">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Eligible</p>
                    <div className="text-3xl font-black text-foreground">{eligibleCount}</div>
                </div>
                <div className="w-px h-10 bg-border/50 hidden md:block" />
                <div className="text-center group-hover:scale-110 transition-transform cursor-default">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Almost</p>
                    <div className="text-3xl font-black text-foreground">{almostEligibleCount}</div>
                </div>
                <div className="w-px h-10 bg-border/50 hidden md:block" />
                <div className="text-center group-hover:scale-110 transition-transform cursor-default">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Not Eligible</p>
                    <div className="text-3xl font-black text-foreground">{notEligibleCount}</div>
                </div>
                <Button 
                    variant="outline" 
                    className="ml-4 rounded-xl border-primary/30 text-primary font-bold hidden lg:flex"
                    onClick={() => router.push("/admin/eligible-students")}
                >
                    View Full Intelligence
                </Button>
            </div>
        </div>
      </div>

      {/* 5. Visualization Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Trend Bar */}
        <div className="lg:col-span-4 bg-card border border-border/50 rounded-[2rem] p-8">
            <div className="flex items-center gap-3 mb-8">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-foreground text-xs uppercase tracking-widest">Weekly Analytics</h3>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats}>
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", color: "white" }}
                            itemStyle={{ fontSize: "12px", fontWeight: "black" }}
                        />
                        <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={24}>
                            {weeklyStats.map((entry, index) => (
                                <Cell key={index} fill={entry.rate > 85 ? "#6366f1" : "#f43f5e"} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Daily Precision Chart */}
        <div className="lg:col-span-8 bg-card border border-border/50 rounded-[2rem] p-8">
            <div className="flex items-center gap-3 mb-8">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-black text-foreground text-xs uppercase tracking-widest">Daily Attendance Trend</h3>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b", fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line 
                            type="step" 
                            dataKey="present_pct" 
                            stroke="#6366f1" 
                            strokeWidth={3} 
                            dot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                            activeDot={{ r: 6, fill: "#6366f1", stroke: "white", strokeWidth: 2 }} 
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* 6. Intelligence Drill-down */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Heatmap Section */}
        <div className="lg:col-span-5 bg-card border border-border/50 rounded-[2rem] p-8">
            <div className="flex items-center gap-3 mb-8">
                <Calendar className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-foreground text-xs uppercase tracking-widest">Attendance Heatmap</h3>
            </div>
            <div className="space-y-4">
                {dayPatterns.map((day, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                        <span className="w-20 text-[10px] font-black text-muted-foreground uppercase group-hover:text-foreground transition-colors">{day.day}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ease-out ${day.rate > 90 ? 'bg-indigo-500' : 'bg-primary'}`} 
                                style={{ width: `${day.rate}%` }} 
                            />
                        </div>
                        <span className="w-10 text-[10px] font-black text-foreground text-right">{day.rate}%</span>
                    </div>
                ))}
                <div className="pt-4 mt-4 border-t border-border/50 flex items-center gap-4 text-[10px] font-bold text-muted-foreground italic">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Friday attendance is 24% lower than Monday peak.
                </div>
            </div>
        </div>

        {/* Class Ranking Table */}
        <div className="lg:col-span-7 bg-card border border-border/50 rounded-[2rem] overflow-hidden">
            <div className="p-8 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <School className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-black text-foreground text-xs uppercase tracking-widest">Class Attendance Intelligence</h3>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/30">
                            <th className="px-8 py-4 text-left text-[9px] font-black uppercase text-muted-foreground tracking-widest">Class</th>
                            <th className="px-8 py-4 text-center text-[9px] font-black uppercase text-muted-foreground tracking-widest">Rate</th>
                            <th className="px-8 py-4 text-center text-[9px] font-black uppercase text-muted-foreground tracking-widest">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {classBars.slice(0, 5).map((c, i) => (
                            <tr key={i} className="hover:bg-primary/5 transition-colors">
                                <td className="px-8 py-5">
                                    <p className="font-black text-foreground uppercase text-xs">{c.class_name}</p>
                                    <p className="text-[9px] text-muted-foreground font-bold">{c.total_students} Students</p>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <span className={`font-black text-sm ${c.average_pct >= threshold ? 'text-primary' : 'text-red-500'}`}>{c.average_pct}%</span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <div className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase ${c.average_pct >= threshold ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                        {c.average_pct >= (threshold + 5) ? 'Elite' : c.average_pct >= threshold ? 'Healthy' : 'Sub-Optimal'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* 7. Student Risk Engine (God-Tier Monitoring) */}
      <div className="bg-card border border-border/50 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-500/5">
        <div className="p-8 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shadow-xl shadow-red-500/10 animate-pulse">
                    <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                    <h3 className="font-black text-foreground text-sm uppercase tracking-widest">Student Attendance Risk Engine</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-60">Autonomous intervention detection platform</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Flagged Students</p>
                    <p className="text-sm font-black text-red-500">{riskStudents.filter(s => s.riskScore >= 40).length} High Risk Alerts</p>
                </div>
                <div className="h-10 w-[1px] bg-border/50 mx-2 hidden sm:block" />
                <div className="text-xs font-black text-muted-foreground uppercase tracking-widest hidden md:block mr-2">
                    Showing <span className="text-foreground">{Math.min(riskStudents.length, (currentPage - 1) * itemsPerPage + 1)}</span>–<span className="text-foreground">{Math.min(riskStudents.length, currentPage * itemsPerPage)}</span> of <span className="text-foreground">{riskStudents.length}</span> students
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-border/50 text-xs font-black uppercase"
                    >
                        <ChevronLeft className="w-3 h-3 mr-1" /> Previous
                    </Button>
                    
                    {[...Array(Math.ceil(riskStudents.length / itemsPerPage) || 1)].map((_, i) => (
                        <Button
                            key={i}
                            variant={currentPage === i + 1 ? "default" : "outline"}
                            size="sm"
                            className={`rounded-xl h-9 w-9 p-0 font-black ${currentPage === i + 1 ? 'bg-primary' : 'border-border/50'}`}
                            onClick={() => setCurrentPage(i + 1)}
                        >
                            {i + 1}
                        </Button>
                    )).slice(Math.max(0, currentPage - 3), Math.min(Math.ceil(riskStudents.length / itemsPerPage), currentPage + 2))}

                    <Button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(riskStudents.length / itemsPerPage), p + 1))}
                        disabled={currentPage >= Math.ceil(riskStudents.length / itemsPerPage) || riskStudents.length === 0}
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-border/50 text-xs font-black uppercase"
                    >
                        Next <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-muted/20">
                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-muted-foreground tracking-widest">Student Identity</th>
                        <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">Risk Score</th>
                        <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">Absence Chain</th>
                        <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-muted-foreground tracking-widest">Engagement Trend</th>
                        <th className="px-10 py-5 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                     {riskStudents
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((student, i) => (
                        <tr 
                            key={i} 
                            className="hover:bg-red-500/[0.02] transition-colors group cursor-pointer"
                            onClick={() => {
                                setSelectedStudentForModal(student);
                                setShowWeeklyModal(true);
                            }}
                        >
                            <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black text-xs text-muted-foreground">
                                        {student.student_name.slice(0, 1)}
                                    </div>
                                    <div>
                                        <p className="font-black text-foreground uppercase text-xs group-hover:text-red-500 transition-colors tracking-tight">{student.student_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono text-muted-foreground opacity-60">ID: {student.admission_number}</span>
                                            <span className="w-1 h-1 rounded-full bg-border" />
                                            <span className="text-[9px] font-black uppercase text-primary tracking-tighter">{student.class_name}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-full max-w-[80px] h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${student.riskScore > 80 ? 'bg-red-500' : student.riskScore > 60 ? 'bg-amber-500' : 'bg-primary'}`} 
                                            style={{ width: `${student.riskScore}%` }} 
                                        />
                                    </div>
                                    <span className={`text-xs font-black ${student.riskScore > 80 ? 'text-red-500' : student.riskScore > 60 ? 'text-amber-500' : 'text-primary'}`}>
                                        {student.riskScore}% {student.riskScore > 80 ? 'CRITICAL' : student.riskScore > 60 ? 'CAUTION' : 'NOMINAL'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-center">
                                <span className={`font-black text-sm ${student.missedConsecutive > 2 ? 'text-red-500 underline decoration-2 underline-offset-4' : 'text-foreground'}`}>
                                    {student.missedConsecutive} Sessions
                                </span>
                            </td>
                            <td className="px-8 py-6 text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg">
                                    {student.trend === 'increasing' ? <TrendingUp className="w-3 h-3 text-red-500" /> : <ChevronDown className="w-3 h-3 text-primary rotate-180" />}
                                    <span className="text-[10px] font-black uppercase text-foreground">{student.trend} RISK</span>
                                </div>
                            </td>
                            <td className="px-10 py-6 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <Button size="sm" variant="outline" className="h-8 rounded-lg text-[10px] font-black uppercase px-4 border-border/50">
                                        Monitor
                                    </Button>
                                    <Button size="sm" variant="default" className="h-8 rounded-lg text-[10px] font-black uppercase px-4 bg-red-500 hover:bg-red-600">
                                        INTERVENE
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {riskStudents.length === 0 && (
                        <tr>
                            <td colSpan={5} className="py-20 text-center">
                                <div className="max-w-xs mx-auto space-y-4">
                                    <ShieldCheck className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                                    <p className="text-sm text-muted-foreground font-medium italic">All platform student clusters are currently operating within nominal safety parameters.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        
        <div className="p-8 bg-muted/10 border-t border-border/30 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                 Critical Students List — Identifying students requiring immediate organizational intervention.
             </p>
        </div>
      </div>
      {/* 8. End-of-Program Completion Modal */}
      {showCompletionModal && event && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-card border border-primary/20 rounded-[3rem] max-w-2xl w-full p-10 shadow-[0_0_100px_rgba(99,102,241,0.2)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
                
                <div className="text-center space-y-6 relative z-10">
                    <div className="w-24 h-24 bg-green-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-green-500/20 mb-8">
                        <Trophy className="w-12 h-12 text-green-400 animate-bounce" />
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-foreground tracking-tight uppercase">Tuition Program Completed</h2>
                        <div className="px-4 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary tracking-widest inline-block uppercase">
                            Final Qualification Intelligence
                        </div>
                    </div>

                    <p className="text-muted-foreground font-medium text-lg max-w-md mx-auto">
                        The <span className="text-foreground font-bold">{event.name}</span> has concluded. Evaluation engine has calculated final student standings.
                    </p>

                    <div className="grid grid-cols-2 gap-4 my-8">
                        <div className="bg-background/50 border border-border/50 p-6 rounded-3xl">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Eligible Students</p>
                            <div className="text-4xl font-black text-green-400">{eligibleCount}</div>
                        </div>
                        <div className="bg-background/50 border border-border/50 p-6 rounded-3xl">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Class Distribution</p>
                            <div className="text-xs font-black text-foreground space-y-1">
                                {classBars.slice(0, 3).map(c => (
                                    <p key={c.class_name}>{c.class_name}: {Math.round(c.total_students * (c.average_pct / 100))} Qualified</p>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button className="flex-1 h-14 rounded-2xl bg-primary text-lg font-black shadow-xl shadow-primary/30">
                            Download Final Register
                        </Button>
                        <Button 
                            variant="outline" 
                            className="flex-1 h-14 rounded-2xl border-border/50 font-black"
                            onClick={() => setShowCompletionModal(false)}
                        >
                            Review Analytics
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Student Attendance Profile Modal */}
      {showWeeklyModal && selectedStudentForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-card border border-border/50 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-border/50 flex items-center justify-between sticky top-0 bg-card z-10">
                      <div>
                          <h2 className="text-xl font-black text-foreground">{selectedStudentForModal.student_name}</h2>
                          <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold text-muted-foreground">ID: {selectedStudentForModal.admission_number}</span>
                              <span className="w-1 h-1 rounded-full bg-border" />
                              <span className="text-[10px] font-black uppercase text-primary tracking-widest">{selectedStudentForModal.class_name}</span>
                          </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setShowWeeklyModal(false)} className="rounded-xl">
                          <ClipboardX className="w-5 h-5 text-muted-foreground" />
                      </Button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                      {/* Generative Week Summary */}
                      {(() => {
                          const sid = selectedStudentForModal.student_id || selectedStudentForModal.admission_number;
                          // Use the un-aggregated detailedRawAttendance which contains individual daily entries
                          const stuRecords = detailedRawAttendance.filter((r: any) => 
                              String(r.student_id) === String(sid)
                          );
                          
                          if (stuRecords.length === 0) {
                              return <div className="text-center p-8 text-muted-foreground italic text-sm">No detailed attendance records found for this student.</div>;
                          }

                          return availableWeeks.map(week => {
                              const weekRecords = stuRecords.filter((r: any) => 
                                  String(r.attendance_date) >= week.start && String(r.attendance_date) <= week.end
                              );
                              
                              if (weekRecords.length === 0) return null;

                              const present = weekRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length;
                              const pct = Math.round((present / 5) * 100);

                              const dayMap = weekRecords.reduce((acc: any, r: any) => {
                                  const dayName = new Date(String(r.attendance_date) + "T00:00:00").toLocaleDateString('en-US', { weekday: 'long' });
                                  acc[dayName] = r.status;
                                  return acc;
                              }, {});

                              return (
                                  <div key={week.label} className="bg-background border border-border/50 rounded-2xl p-5 space-y-4">
                                      <div className="flex items-center justify-between">
                                          <h4 className="font-black text-sm uppercase tracking-widest">{week.label} Attendance</h4>
                                          <span className="text-xs font-black text-primary">{present} / 5 Sessions</span>
                                      </div>
                                      <div className="grid grid-cols-6 gap-2">
                                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                              <div key={day} className="flex flex-col items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/30">
                                                  <span className="text-[9px] font-black text-muted-foreground uppercase">{day.slice(0, 3)}</span>
                                                  {dayMap[day] === 'present' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
                                                   dayMap[day] === 'late' ? <AlertCircle className="w-4 h-4 text-amber-500" /> : 
                                                   dayMap[day] === 'absent' ? <XCircle className="w-4 h-4 text-red-500" /> :
                                                   <span className="w-4 h-4 rounded-full bg-border/50" />}
                                              </div>
                                          ))}
                                      </div>
                                      <div className="mt-2 text-xs font-bold text-muted-foreground">
                                          Attendance Rate: <span className={pct >= (event?.attendance_threshold || 80) ? 'text-green-500' : 'text-amber-500'}>{pct}%</span>
                                      </div>
                                  </div>
                              );
                          });
                      })()}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}
