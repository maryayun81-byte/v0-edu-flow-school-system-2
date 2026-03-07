"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
} from "lucide-react";

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

interface TuitionEvent {
  id: string;
  name: string;
  attendance_threshold: number;
}

export default function AttendanceAnalytics() {
  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(false);

  const [avgAttendance, setAvgAttendance] = useState<number>(0);
  const [belowThresholdCount, setBelowThresholdCount] = useState(0);
  const [classBars, setClassBars] = useState<ClassAttendanceStat[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [lowStudents, setLowStudents] = useState<LowAttendanceStudent[]>([]);
  const [missedAlerts, setMissedAlerts] = useState<MissedAlert[]>([]);

  useEffect(() => {
    fetchEvents();
    fetchMissedAlerts();
  }, []);

  useEffect(() => {
    if (selectedEventId) loadAnalytics(selectedEventId);
  }, [selectedEventId]);

  async function fetchEvents() {
    const { data } = await supabase
      .from("tuition_events")
      .select("id, name, attendance_threshold")
      .order("start_date", { ascending: false });
    setEvents(data || []);
    if (data && data.length > 0) setSelectedEventId(data[0].id);
  }

  async function fetchMissedAlerts() {
    try {
      const { data } = await supabase
        .from("missed_attendance_alerts")
        .select("class_name, teacher_name, attendance_date, event_name");
      setMissedAlerts(data || []);
    } catch {
      // View may not exist yet, ignore
    }
  }

  async function loadAnalytics(eventId: string) {
    setLoading(true);
    const event = events.find(e => e.id === eventId);
    const threshold = event?.attendance_threshold || 80;

    // Fetch eligibility data for the event
    const { data: eligibility } = await supabase
      .from("exam_eligibility")
      .select(`
        student_id, attendance_percentage, is_eligible, class_id,
        profiles!exam_eligibility_student_id_fkey(full_name, admission_number),
        classes!exam_eligibility_class_id_fkey(name)
      `)
      .eq("event_id", eventId);

    if (eligibility && eligibility.length > 0) {
      // Average attendance
      const avg = eligibility.reduce((sum: number, r: any) => sum + Number(r.attendance_percentage), 0) / eligibility.length;
      setAvgAttendance(Math.round(avg * 10) / 10);

      // Below threshold
      setBelowThresholdCount(eligibility.filter((r: any) => !r.is_eligible).length);

      // By class
      const classMap: Record<string, { total: number; sum: number }> = {};
      eligibility.forEach((r: any) => {
        const cn = r.classes?.name || "Unknown";
        if (!classMap[cn]) classMap[cn] = { total: 0, sum: 0 };
        classMap[cn].total++;
        classMap[cn].sum += Number(r.attendance_percentage);
      });
      setClassBars(Object.entries(classMap).map(([class_name, v]) => ({
        class_name,
        average_pct: Math.round((v.sum / v.total) * 10) / 10,
        total_students: v.total,
      })).sort((a, b) => b.average_pct - a.average_pct));

      // Low attendance students
      const low = eligibility
        .filter((r: any) => !r.is_eligible)
        .map((r: any) => ({
          student_name: r.profiles?.full_name || "Unknown",
          admission_number: r.profiles?.admission_number || "",
          class_name: r.classes?.name || "Unknown",
          attendance_percentage: Number(r.attendance_percentage),
        }))
        .sort((a, b) => a.attendance_percentage - b.attendance_percentage);
      setLowStudents(low);
    } else {
      setAvgAttendance(0);
      setBelowThresholdCount(0);
      setClassBars([]);
      setLowStudents([]);
    }

    // Daily attendance trend (from attendance table)
    const { data: dailyData } = await supabase
      .from("attendance")
      .select("attendance_date, status")
      .eq("event_id", eventId)
      .order("attendance_date");

    if (dailyData && dailyData.length > 0) {
      const dateMap: Record<string, { present: number; total: number }> = {};
      dailyData.forEach((r: { attendance_date: string; status: string }) => {
        const d = r.attendance_date;
        if (!dateMap[d]) dateMap[d] = { present: 0, total: 0 };
        dateMap[d].total++;
        if (r.status === "present" || r.status === "late") dateMap[d].present++;
      });
      const trend = Object.entries(dateMap).map(([date, v]) => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
        present_pct: Math.round((v.present / v.total) * 100),
        total: v.total,
      }));
      setDailyTrend(trend);
    } else {
      setDailyTrend([]);
    }

    setLoading(false);
  }

  const event = events.find(e => e.id === selectedEventId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Attendance Analytics</h2>
          <p className="text-sm text-muted-foreground">Overview of attendance performance across events and classes</p>
        </div>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="bg-muted border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Missed Alerts */}
      {missedAlerts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardX className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-destructive">
              ⚠ Attendance Not Submitted Today ({missedAlerts.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50">
                  <th className="pb-2 text-left">Class</th>
                  <th className="pb-2 text-left">Teacher</th>
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-left">Event</th>
                </tr>
              </thead>
              <tbody>
                {missedAlerts.map((a, i) => (
                  <tr key={i} className="border-b border-border/20 last:border-0">
                    <td className="py-2 font-medium text-foreground">{a.class_name}</td>
                    <td className="py-2 text-muted-foreground">{a.teacher_name}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(a.attendance_date + "T00:00:00").toLocaleDateString("en-KE")}
                    </td>
                    <td className="py-2 text-muted-foreground">{a.event_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Avg Attendance Rate</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{avgAttendance}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Threshold: {event?.attendance_threshold || 80}%
              </p>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Below Threshold</span>
              </div>
              <p className="text-3xl font-bold text-red-400">{belowThresholdCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Students at risk</p>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Eligible Students</span>
              </div>
              <p className="text-3xl font-bold text-green-400">
                {Math.max(0, (classBars.reduce((sum, c) => sum + c.total_students, 0)) - belowThresholdCount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ready for exam</p>
            </div>
          </div>

          {/* Charts Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart: Attendance by Class */}
            {classBars.length > 0 && (
              <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Attendance by Class</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classBars} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="class_name" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(v: number) => [`${v}%`, "Avg Attendance"]}
                    />
                    <Bar dataKey="average_pct" radius={[6, 6, 0, 0]}>
                      {classBars.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.average_pct >= (event?.attendance_threshold || 80) ? "#22c55e" : "#ef4444"}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Line Chart: Daily Attendance Trend */}
            {dailyTrend.length > 0 && (
              <div className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Daily Attendance Trend</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyTrend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(v: number) => [`${v}%`, "Attendance Rate"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="present_pct"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Low Attendance Students Table */}
          {lowStudents.length > 0 && (
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="font-semibold text-foreground">
                  Low Attendance Students ({lowStudents.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">Student</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">Class</th>
                      <th className="px-4 py-3 text-center text-muted-foreground font-medium">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lowStudents.map((s, i) => (
                      <tr key={i} className="bg-red-500/5 hover:bg-red-500/10 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{s.student_name}</p>
                          <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.class_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-red-400">{s.attendance_percentage.toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {classBars.length === 0 && dailyTrend.length === 0 && (
            <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No analytics data yet. Generate the exam eligibility list to populate charts.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
