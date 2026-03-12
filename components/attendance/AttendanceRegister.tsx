import { useState, useEffect, useCallback } from "react";
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
  Search, 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Clock, 
  Users,
  ChevronRight,
  ChevronLeft,
  Calendar,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  Shield,
  Save,
  Send,
  ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const supabase = createClient();

type AttendanceStatus = "present" | "late" | "absent" | "excused";

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
}

interface TuitionEvent {
  id: string;
  name: string;
  status: string;
}

interface CalendarDate {
  calendar_date: string;
  day_number: number;
  is_exam_day: boolean;
  day_of_week: string;
}

interface AttendanceRecord {
  [studentId: string]: AttendanceStatus;
}

const statusConfig: Record<AttendanceStatus, { label: string; icon: any; color: string; bg: string }> = {
  present: { label: "Present", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/20 border-green-500/40" },
  late: { label: "Late", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/40" },
  absent: { label: "Absent", icon: XCircle, color: "text-red-400", bg: "bg-red-500/20 border-red-500/40" },
  excused: { label: "Excused", icon: Shield, color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/40" },
};

export default function AttendanceRegister({ teacherId }: { teacherId: string }) {
  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<{ classId: string; className: string } | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);

  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [calendarDates, setCalendarDates] = useState<CalendarDate[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [weeks, setWeeks] = useState<{ weekNumber: number; label: string; dates: CalendarDate[] }[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("all");

  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [existingRecord, setExistingRecord] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Load teacher's class
  useEffect(() => {
    loadTeacherClass();
    loadEvents();
  }, [teacherId]);

  async function loadTeacherClass() {
    const { data } = await supabase
      .from("class_teachers")
      .select("class_id, classes(id, name)")
      .eq("teacher_id", teacherId)
      .single();

    if (data) {
      const cls = (data as any).classes;
      setClassInfo({ classId: cls.id, className: cls.name });
      setIsClassTeacher(true);
      loadStudents(cls.id);
    } else {
      setIsClassTeacher(false);
    }
    setLoading(false);
  }

  async function loadEvents() {
    const { data } = await supabase
      .from("tuition_events")
      .select("id, name, status, start_date, end_date")
      .order("start_date", { ascending: false });
    
    if (data && data.length > 0) {
      setEvents(data);
      // Auto-select the most relevant event (Active or closest to today)
      const today = new Date().toLocaleDateString('en-CA');
      const activeEvent = data.find((e: any) => e.status === "active") || 
                        data.find((e: any) => today >= e.start_date && today <= e.end_date) || 
                        data[0];
      
      if (activeEvent) {
        setSelectedEventId(activeEvent.id);
      }
    }
  }

  async function loadStudents(classId: string) {
    // Load students whose form_class matches the class name
    const { data: classData } = await supabase
      .from("classes")
      .select("name")
      .eq("id", classId)
      .single();

    if (!classData) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, admission_number")
      .eq("role", "student")
      .eq("form_class", classData.name)
      .order("full_name");

    if (data) {
      setStudents(data);
      // Default all to present
      const defaults: AttendanceRecord = {};
      data.forEach((s: Student) => { defaults[s.id] = "present"; });
      setAttendance(defaults);
    }
  }

  useEffect(() => {
    if (selectedEventId) {
      loadCalendarDates(selectedEventId);
    }
  }, [selectedEventId]);

  async function loadCalendarDates(eventId: string) {
    const { data } = await supabase
      .from("event_calendar")
      .select("calendar_date, day_number, is_exam_day, day_of_week")
      .eq("event_id", eventId)
      .order("day_number");
    
    if (data) {
      setCalendarDates(data);
      
      // Calculate weeks (grouping by 7 days based on day_number)
      const generatedWeeks: { weekNumber: number; label: string; dates: CalendarDate[] }[] = [];
      data.forEach((d: any) => {
        const wNum = Math.floor((d.day_number - 1) / 7) + 1;
        let existingWeek = generatedWeeks.find(w => w.weekNumber === wNum);
        if (!existingWeek) {
          existingWeek = { weekNumber: wNum, label: `Week ${wNum}`, dates: [] };
          generatedWeeks.push(existingWeek);
        }
        existingWeek.dates.push(d);
      });
      setWeeks(generatedWeeks);

      // Auto-select today if it's in the calendar
      const todayStr = new Date().toLocaleDateString('en-CA');
      const todayEntry = data.find((d: any) => d.calendar_date === todayStr);
      if (todayEntry) {
        setSelectedDate(todayEntry.calendar_date);
        const wNum = Math.floor((todayEntry.day_number - 1) / 7) + 1;
        setSelectedWeek(wNum.toString());
      }
    }
  }

  // Filter dates based on selected week
  const filteredDates = selectedWeek === "all" 
    ? calendarDates 
    : calendarDates.filter(d => Math.floor((d.day_number - 1) / 7) + 1 === parseInt(selectedWeek));

  useEffect(() => {
    if (selectedEventId && selectedDate && classInfo) {
      checkExistingRecord();
    }
  }, [selectedEventId, selectedDate, classInfo]);

  async function checkExistingRecord() {
    if (!classInfo) return;
    const { data } = await supabase
      .from("attendance")
      .select("id, student_id, status")
      .eq("event_id", selectedEventId)
      .eq("attendance_date", selectedDate)
      .eq("class_id", classInfo.classId);

    if (data && data.length > 0) {
      setExistingRecord(true);
      // Load existing statuses
      const loaded: AttendanceRecord = {};
      data.forEach((r: any) => { loaded[r.student_id] = r.status; });
      setAttendance(prev => ({ ...prev, ...loaded }));
    } else {
      setExistingRecord(false);
    }
  }

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setAutoSaveStatus("saving");
    setTimeout(() => setAutoSaveStatus("saved"), 800);
  }

  function markAllPresent() {
    const all: AttendanceRecord = {};
    students.forEach(s => { all[s.id] = "present"; });
    setAttendance(all);
  }

  async function handleSubmit() {
    if (!selectedEventId || !selectedDate || !classInfo) {
      setError("Please select an event and a valid attendance date.");
      return;
    }
    if (existingRecord) {
      setError("Attendance already recorded for this class on this date.");
      return;
    }
    if (students.length === 0) {
      setError("No students found for this class.");
      return;
    }

    setSubmitting(true);
    setError("");

    const records = students.map(s => ({
      event_id: selectedEventId,
      student_id: s.id,
      class_id: classInfo.classId,
      attendance_date: selectedDate,
      status: attendance[s.id] || "absent",
      marked_by: teacherId,
    }));

    const { error: insertError } = await supabase.from("attendance").insert(records);

    if (insertError) {
      if (insertError.code === "23505" || insertError.message?.includes("unique")) {
        setError("Attendance already recorded for this class on this date.");
      } else {
        setError(insertError.message);
      }
    } else {
      // Log the action
      await supabase.from("attendance_logs").insert({
        event_id: selectedEventId,
        action: "register_submitted",
        performed_by: teacherId,
        class_id: classInfo.classId,
        attendance_date: selectedDate,
        details: {
          total_students: students.length,
          present: records.filter(r => r.status === "present").length,
          late: records.filter(r => r.status === "late").length,
          absent: records.filter(r => r.status === "absent").length,
          excused: records.filter(r => r.status === "excused").length,
        },
      });

      setSubmitSuccess(true);
      setExistingRecord(true);
    }
    setSubmitting(false);
  }

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.admission_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-dismiss messages
  useEffect(() => {
    if (submitSuccess) {
      const timer = setTimeout(() => setSubmitSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Summary counts
  const counts = {
    present: Object.values(attendance).filter((v: any) => v === "present").length,
    late: Object.values(attendance).filter((v: any) => v === "late").length,
    absent: Object.values(attendance).filter((v: any) => v === "absent").length,
    excused: Object.values(attendance).filter((v: any) => v === "excused").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isClassTeacher) {
    return (
      <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Access Restricted</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          You are not authorized to mark attendance. Only designated class teachers can mark the attendance register.
          Please contact your administrator to be assigned as a class teacher.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Mark Attendance Register</h2>
          <p className="text-sm text-muted-foreground">
            Class: <span className="font-semibold text-primary">{classInfo?.className}</span>
            {" · "}{students.length} students
          </p>
        </div>
        {autoSaveStatus === "saving" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Save className="w-3 h-3 animate-pulse" />Saving draft...
          </span>
        )}
        {autoSaveStatus === "saved" && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />Draft saved
          </span>
        )}
      </div>

      {/* Event & Date Selection */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-foreground text-sm">Select Event & Date</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tuition Event</label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="bg-muted border-border/50 h-11">
                <SelectValue placeholder="Select tuition event..." />
              </SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <SelectItem value="_none" disabled>No active events</SelectItem>
                ) : (
                  events.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {weeks.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter by Week</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="bg-muted border-border/50 h-11">
                  <SelectValue placeholder="All Weeks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Weeks</SelectItem>
                  {weeks.map(w => (
                    <SelectItem key={w.weekNumber} value={w.weekNumber.toString()}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attendance Date</label>
            <Select
              value={selectedDate}
              onValueChange={setSelectedDate}
              disabled={!selectedEventId || calendarDates.length === 0}
            >
              <SelectTrigger className="bg-muted border-border/50 h-11">
                <SelectValue placeholder={selectedEventId ? "Select a valid date..." : "Select event first"} />
              </SelectTrigger>
              <SelectContent>
                {filteredDates.map(d => (
                  <SelectItem key={d.calendar_date} value={d.calendar_date}>
                    Day {d.day_number} — {new Date(d.calendar_date + "T00:00:00").toLocaleDateString("en-KE", {
                      weekday: "short", day: "numeric", month: "long"
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Smart Register Header */}
      {selectedEventId && selectedDate && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-primary tracking-tight">
              {events.find(e => e.id === selectedEventId)?.name}
            </h3>
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Users className="w-4 h-4" />
              <span>Class: {classInfo?.className}</span>
              <span className="opacity-30">|</span>
              <Clock className="w-4 h-4" />
              <span>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-KE", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric"
                })}
              </span>
            </div>
          </div>
          <Badge variant="outline" className="w-fit bg-primary/20 text-primary border-primary/30 px-4 py-1.5 text-sm font-bold">
            Day {calendarDates.find(d => d.calendar_date === selectedDate)?.day_number || "?"}
          </Badge>
        </div>
      )}

      {/* Existing Record Warning */}
      {existingRecord && !submitSuccess && (
        <div className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Attendance already recorded for this date. Contact admin for corrections.</span>
          </div>
          <button onClick={() => setExistingRecord(false)} className="hover:opacity-70">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Submit Success */}
      {submitSuccess && (
        <div className="flex items-center justify-between gap-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Attendance register submitted successfully!</span>
          </div>
          <button onClick={() => setSubmitSuccess(false)} className="hover:opacity-70">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="hover:opacity-70">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Register Table */}
      {selectedDate && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          {/* Table Controls */}
          <div className="p-4 border-b border-border/50 flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-4 py-2 bg-muted border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search student..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={markAllPresent}
              disabled={existingRecord}
              className="bg-transparent border-border/50"
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />
              Mark All Present
            </Button>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-4 gap-0 border-b border-border/50">
            {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((s: AttendanceStatus) => (
              <div key={s} className="p-3 text-center border-r border-border/50 last:border-r-0">
                <div className={`text-xl font-bold ${statusConfig[s].color}`}>{counts[s]}</div>
                <div className="text-xs text-muted-foreground capitalize">{s}</div>
              </div>
            ))}
          </div>

          {/* Students List */}
          <div className="divide-y divide-border/50">
            {filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                {searchQuery ? "No students match your search." : "No students found for this class."}
              </div>
            ) : (
              filteredStudents.map((student, idx) => {
                const currentStatus = attendance[student.id] || "absent";
                return (
                  <div
                    key={student.id}
                    className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                      existingRecord ? "opacity-70" : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Number */}
                    <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">
                      {idx + 1}
                    </span>

                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {student.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.admission_number}</p>
                    </div>

                    {/* Status Buttons */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map(status => {
                        const cfg = statusConfig[status];
                        const isActive = currentStatus === status;
                        return (
                          <button
                            key={status}
                            disabled={existingRecord}
                            onClick={() => setStudentStatus(student.id, status)}
                            title={cfg.label}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isActive
                                ? `${cfg.bg} ${cfg.color} scale-105`
                                : "bg-transparent border-border/30 text-muted-foreground hover:border-border/60"
                            } ${existingRecord ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {status.charAt(0).toUpperCase()}{status === "excused" ? "x" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Submit */}
          {!existingRecord && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {counts.present} present · {counts.late} late · {counts.absent} absent · {counts.excused} excused
              </p>
              <Button
                onClick={handleSubmit}
                disabled={submitting || students.length === 0}
                className="bg-primary hover:bg-primary/90 min-w-[140px]"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Submit Register
              </Button>
            </div>
          )}
        </div>
      )}

      {!selectedDate && selectedEventId && (
        <div className="text-center py-10 bg-card border border-border/50 rounded-2xl">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Select a date to start marking attendance</p>
        </div>
      )}

      {!selectedEventId && (
        <div className="text-center py-10 bg-card border border-border/50 rounded-2xl">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Select a tuition event to begin</p>
        </div>
      )}
    </div>
  );
}
