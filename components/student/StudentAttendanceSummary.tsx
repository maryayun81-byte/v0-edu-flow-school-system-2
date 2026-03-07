"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Calendar,
  TrendingUp,
} from "lucide-react";

const supabase = createClient();

interface AttendanceSummaryData {
  event_id: string;
  event_name: string;
  days_present: number;
  days_late: number;
  days_absent: number;
  days_excused: number;
  total_eval_days: number;
  adjusted_eval_days: number;
  attendance_percentage: number;
  is_eligible: boolean;
  threshold: number;
}

interface RecentDay {
  attendance_date: string;
  status: "present" | "late" | "absent" | "excused";
  event_name: string;
}

const statusColors: Record<string, string> = {
  present: "bg-green-500",
  late: "bg-amber-500",
  absent: "bg-red-500",
  excused: "bg-blue-500",
};

export default function StudentAttendanceSummary({ studentId }: { studentId: string }) {
  const [summaries, setSummaries] = useState<AttendanceSummaryData[]>([]);
  const [recentDays, setRecentDays] = useState<RecentDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      loadData();
    }
  }, [studentId]);

  async function loadData() {
    setLoading(true);

    // Load eligibility records for this student (includes computed attendance)
    const { data: eligibilityData } = await supabase
      .from("exam_eligibility")
      .select(`
        event_id, days_present, days_late, days_absent, days_excused,
        total_eval_days, adjusted_eval_days, attendance_percentage, is_eligible, threshold_used,
        tuition_events!exam_eligibility_event_id_fkey(name, attendance_threshold)
      `)
      .eq("student_id", studentId)
      .order("calculated_at", { ascending: false });

    if (eligibilityData && eligibilityData.length > 0) {
      setSummaries(eligibilityData.map((r: any) => ({
        event_id: r.event_id,
        event_name: r.tuition_events?.name || "Unknown Event",
        days_present: r.days_present,
        days_late: r.days_late,
        days_absent: r.days_absent,
        days_excused: r.days_excused,
        total_eval_days: r.total_eval_days,
        adjusted_eval_days: r.adjusted_eval_days,
        attendance_percentage: Number(r.attendance_percentage),
        is_eligible: r.is_eligible,
        threshold: r.threshold_used || r.tuition_events?.attendance_threshold || 80,
      })));
    } else {
      // Fallback: compute from raw attendance
      const { data: rawAttendance } = await supabase
        .from("attendance")
        .select(`
          event_id, status,
          tuition_events!attendance_event_id_fkey(name, attendance_eval_days, attendance_threshold)
        `)
        .eq("student_id", studentId);

      if (rawAttendance && rawAttendance.length > 0) {
        const eventMap: Record<string, any> = {};
        rawAttendance.forEach((r: any) => {
          const eid = r.event_id;
          if (!eventMap[eid]) {
            eventMap[eid] = {
              event_id: eid,
              event_name: r.tuition_events?.name || "Unknown",
              total_eval_days: r.tuition_events?.attendance_eval_days || 12,
              threshold: r.tuition_events?.attendance_threshold || 80,
              present: 0, late: 0, absent: 0, excused: 0,
            };
          }
          if (r.status === "present") eventMap[eid].present++;
          else if (r.status === "late") eventMap[eid].late++;
          else if (r.status === "absent") eventMap[eid].absent++;
          else if (r.status === "excused") eventMap[eid].excused++;
        });

        const computed = Object.values(eventMap).map((e: any) => {
          const adj = e.total_eval_days - e.excused;
          const pct = adj > 0 ? ((e.present + e.late) / adj) * 100 : 0;
          return {
            event_id: e.event_id,
            event_name: e.event_name,
            days_present: e.present,
            days_late: e.late,
            days_absent: e.absent,
            days_excused: e.excused,
            total_eval_days: e.total_eval_days,
            adjusted_eval_days: Math.max(0, adj),
            attendance_percentage: Math.min(100, parseFloat(pct.toFixed(1))),
            is_eligible: pct >= e.threshold,
            threshold: e.threshold,
          };
        });
        setSummaries(computed);
      }
    }

    // Load recent 30 days of attendance for calendar view
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recent } = await supabase
      .from("attendance")
      .select(`
        attendance_date, status,
        tuition_events!attendance_event_id_fkey(name)
      `)
      .eq("student_id", studentId)
      .gte("attendance_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("attendance_date", { ascending: false })
      .limit(30);

    if (recent) {
      setRecentDays(recent.map((r: any) => ({
        attendance_date: r.attendance_date,
        status: r.status,
        event_name: r.tuition_events?.name || "Unknown",
      })));
    }

    setLoading(false);
  }


  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-muted/50 rounded-2xl" />
        <div className="h-32 bg-muted/50 rounded-2xl" />
      </div>
    );
  }

  if (summaries.length === 0 && recentDays.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-lg font-semibold text-foreground mb-2">No Attendance Records Yet</p>
        <p className="text-sm text-muted-foreground">
          Your attendance will appear here once your teacher starts marking the register.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Tuition Attendance
      </h3>

      {/* Per-Event Summaries */}
      {summaries.map(summary => (
        <div key={summary.event_id} className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <h4 className="font-semibold text-foreground">{summary.event_name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Threshold: {summary.threshold}% · Evaluated: {summary.adjusted_eval_days} days
              </p>
            </div>
            {summary.is_eligible ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Eligible for Exam
              </Badge>
            ) : (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 gap-1">
                <XCircle className="w-3.5 h-3.5" />
                Not Eligible
              </Badge>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Attendance Rate</span>
              <span className={`font-bold ${
                summary.attendance_percentage >= summary.threshold ? "text-green-400" : "text-red-400"
              }`}>
                {summary.attendance_percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  summary.attendance_percentage >= summary.threshold ? "bg-green-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, summary.attendance_percentage)}%` }}
              />
            </div>
            {/* Threshold marker */}
            <div className="relative h-2 mt-0.5">
              <div
                className="absolute top-0 w-0.5 h-2 bg-amber-400 opacity-70"
                style={{ left: `${summary.threshold}%` }}
                title={`Threshold: ${summary.threshold}%`}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Present", value: summary.days_present, color: "text-green-400", icon: CheckCircle2 },
              { label: "Late", value: summary.days_late, color: "text-amber-400", icon: Clock },
              { label: "Absent", value: summary.days_absent, color: "text-red-400", icon: XCircle },
              { label: "Excused", value: summary.days_excused, color: "text-blue-400", icon: Shield },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="text-center bg-muted/50 rounded-xl p-2.5">
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Recent Attendance Mini Calendar */}
      {recentDays.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Recent Attendance (Last 30 Days)
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {[...recentDays].reverse().map((day, i) => (
              <div
                key={i}
                title={`${day.attendance_date}: ${day.status} (${day.event_name})`}
                className={`w-7 h-7 rounded-md ${statusColors[day.status]} opacity-80 cursor-default`}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {[
              { s: "present", label: "Present" },
              { s: "late", label: "Late" },
              { s: "absent", label: "Absent" },
              { s: "excused", label: "Excused" },
            ].map(({ s, label }) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${statusColors[s]}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
