"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  AlertCircle,
  Users,
  Search,
} from "lucide-react";

const supabase = createClient();

interface AttendanceRecord {
  student_id: string;
  status: string;
  class_id: string;
}

interface EligibilityRow {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  days_present: number;
  days_late: number;
  days_absent: number;
  days_excused: number;
  total_eval_days: number;
  adjusted_eval_days: number;
  attendance_percentage: number;
  is_eligible: boolean;
}

interface TuitionEvent {
  id: string;
  name: string;
  attendance_eval_days: number;
  attendance_threshold: number;
  exam_day_number: number;
  status: string;
}

export default function ExamEligibilityList({ adminId }: { adminId: string }) {
  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eligibilityData, setEligibilityData] = useState<EligibilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadExistingEligibility();
    }
  }, [selectedEventId]);

  async function fetchEvents() {
    const { data } = await supabase
      .from("tuition_events")
      .select("id, name, attendance_eval_days, attendance_threshold, exam_day_number, status")
      .order("start_date", { ascending: false });
    setEvents(data || []);
  }

  async function loadExistingEligibility() {
    setLoading(true);
    const { data } = await supabase
      .from("exam_eligibility")
      .select(`
        student_id, days_present, days_late, days_absent, days_excused,
        total_eval_days, adjusted_eval_days, attendance_percentage, is_eligible,
        profiles!exam_eligibility_student_id_fkey(full_name, admission_number),
        classes!exam_eligibility_class_id_fkey(name)
      `)
      .eq("event_id", selectedEventId)
      .order("attendance_percentage", { ascending: false });

    if (data && data.length > 0) {
      setEligibilityData(data.map((r: any) => ({
        student_id: r.student_id,
        student_name: r.profiles?.full_name || "Unknown",
        admission_number: r.profiles?.admission_number || "",
        class_name: r.classes?.name || "Unknown",
        days_present: r.days_present,
        days_late: r.days_late,
        days_absent: r.days_absent,
        days_excused: r.days_excused,
        total_eval_days: r.total_eval_days,
        adjusted_eval_days: r.adjusted_eval_days,
        attendance_percentage: Number(r.attendance_percentage),
        is_eligible: r.is_eligible,
      })));
    } else {
      setEligibilityData([]);
    }
    setLoading(false);
  }

  async function generateEligibility() {
    if (!selectedEventId) return;
    setGenerating(true);
    setError("");

    const event = events.find(e => e.id === selectedEventId);
    if (!event) { setGenerating(false); return; }

    // Get event calendar (eval days only)
    const { data: calDays } = await supabase
      .from("event_calendar")
      .select("calendar_date")
      .eq("event_id", selectedEventId)
      .eq("is_exam_day", false);

    const totalEvalDays = calDays?.length || event.attendance_eval_days;

    // Get all students with attendance for this event
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("student_id, status, class_id")
      .eq("event_id", selectedEventId);

    if (!attendanceData || attendanceData.length === 0) {
      setError("No attendance records found for this event. Ensure teachers have submitted registers.");
      setGenerating(false);
      return;
    }

    // Group by student
    const studentMap: Record<string, { present: number; late: number; absent: number; excused: number; classId: string }> = {};
    attendanceData.forEach((r: AttendanceRecord) => {
      if (!studentMap[r.student_id]) {
        studentMap[r.student_id] = { present: 0, late: 0, absent: 0, excused: 0, classId: r.class_id };
      }
      if (r.status === "present") studentMap[r.student_id].present++;
      else if (r.status === "late") studentMap[r.student_id].late++;
      else if (r.status === "absent") studentMap[r.student_id].absent++;
      else if (r.status === "excused") studentMap[r.student_id].excused++;
    });

    // Compute eligibility for each student
    const rows = Object.entries(studentMap).map(([studentId, counts]) => {
      const adjustedDays = totalEvalDays - counts.excused;
      const attendedDays = counts.present + counts.late;
      const pct = adjustedDays > 0 ? (attendedDays / adjustedDays) * 100 : 0;
      const isEligible = pct >= event.attendance_threshold;

      return {
        event_id: selectedEventId,
        student_id: studentId,
        class_id: counts.classId,
        total_eval_days: totalEvalDays,
        days_present: counts.present,
        days_late: counts.late,
        days_absent: counts.absent,
        days_excused: counts.excused,
        adjusted_eval_days: Math.max(0, adjustedDays),
        attendance_percentage: Math.min(100, parseFloat(pct.toFixed(2))),
        is_eligible: isEligible,
        threshold_used: event.attendance_threshold,
        generated_by: adminId,
        calculated_at: new Date().toISOString(),
      };
    });

    // Upsert to exam_eligibility
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("exam_eligibility")
        .upsert(rows, { onConflict: "event_id,student_id" });

      if (upsertError) {
        setError("Failed to save eligibility: " + upsertError.message);
        setGenerating(false);
        return;
      }
    }

    // Log
    await supabase.from("attendance_logs").insert({
      event_id: selectedEventId,
      action: "eligibility_generated",
      performed_by: adminId,
      details: {
        total_students: rows.length,
        eligible: rows.filter(r => r.is_eligible).length,
        not_eligible: rows.filter(r => !r.is_eligible).length,
      },
    });

    await loadExistingEligibility();
    setGenerating(false);
  }

  function exportCSV() {
    if (filteredData.length === 0) return;
    const headers = ["Name", "Admission No.", "Class", "Present", "Late", "Absent", "Excused", "Eval Days", "Adj. Days", "Attendance %", "Status"];
    const rows = filteredData.map(r => [
      r.student_name, r.admission_number, r.class_name,
      r.days_present, r.days_late, r.days_absent, r.days_excused,
      r.total_eval_days, r.adjusted_eval_days,
      r.attendance_percentage.toFixed(1) + "%",
      r.is_eligible ? "Eligible" : "Not Eligible",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const event = events.find(e => e.id === selectedEventId);
    a.download = `exam_eligibility_${event?.name?.replace(/\s+/g, "_") || "list"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allClasses = [...new Set(eligibilityData.map(r => r.class_name))].sort();

  const filteredData = eligibilityData.filter(r => {
    const matchesSearch = !searchQuery ||
      r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.admission_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === "all" || r.class_name === classFilter;
    return matchesSearch && matchesClass;
  });

  const eligibleCount = filteredData.filter(r => r.is_eligible).length;
  const notEligibleCount = filteredData.filter(r => !r.is_eligible).length;
  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Exam Eligibility List</h2>
          <p className="text-sm text-muted-foreground">
            Generate and view exam eligibility based on attendance records
          </p>
        </div>
        {eligibilityData.length > 0 && (
          <Button variant="outline" onClick={exportCSV} className="bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Event Selection + Generate */}
      <div className="bg-card border border-border/50 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Select Tuition Event</label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="bg-muted border-border/50 h-11">
                <SelectValue placeholder="Choose an event to generate eligibility..." />
              </SelectTrigger>
              <SelectContent>
                {events.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — Threshold: {e.attendance_threshold}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedEventId && (
            <Button
              onClick={generateEligibility}
              disabled={generating}
              className="bg-primary hover:bg-primary/90 h-11"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trophy className="w-4 h-4 mr-2" />
              )}
              {generating ? "Generating..." : eligibilityData.length > 0 ? "Regenerate" : "Generate Exam List"}
            </Button>
          )}
        </div>

        {selectedEvent && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Eval Days: <strong className="text-foreground">{selectedEvent.attendance_eval_days}</strong></span>
            <span>Exam Day: <strong className="text-foreground">Day {selectedEvent.exam_day_number}</strong></span>
            <span>Threshold: <strong className="text-foreground">{selectedEvent.attendance_threshold}%</strong></span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : eligibilityData.length > 0 ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{filteredData.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Students</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{eligibleCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Eligible</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{notEligibleCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Not Eligible</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-4 py-2 bg-muted border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search student..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {allClasses.length > 1 && (
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-44 bg-muted border-border/50">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {allClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Table */}
          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Class</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Present</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Late</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Absent</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Excused</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Adj. Days</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Attendance %</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredData.map((row, idx) => (
                    <tr
                      key={row.student_id}
                      className={`transition-colors ${
                        row.is_eligible
                          ? "bg-green-500/5 hover:bg-green-500/10"
                          : "bg-red-500/5 hover:bg-red-500/10"
                      }`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{row.student_name}</p>
                          <p className="text-xs text-muted-foreground">{row.admission_number}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.class_name}</td>
                      <td className="px-4 py-3 text-center font-medium text-green-400">{row.days_present}</td>
                      <td className="px-4 py-3 text-center font-medium text-amber-400">{row.days_late}</td>
                      <td className="px-4 py-3 text-center font-medium text-red-400">{row.days_absent}</td>
                      <td className="px-4 py-3 text-center font-medium text-blue-400">{row.days_excused}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{row.adjusted_eval_days}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${
                          row.attendance_percentage >= (selectedEvent?.attendance_threshold || 80)
                            ? "text-green-400"
                            : "text-red-400"
                        }`}>
                          {row.attendance_percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_eligible ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Eligible
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Eligible
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : selectedEventId ? (
        <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Eligibility Data</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Click "Generate Exam List" to compute eligibility from attendance records.
          </p>
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Select a tuition event to view or generate the exam eligibility list.</p>
        </div>
      )}
    </div>
  );
}
