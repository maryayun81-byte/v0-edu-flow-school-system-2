"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Plus,
  X,
  Edit2,
  Trash2,
  CalendarDays,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const supabase = createClient();

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface TuitionEvent {
  id: string;
  name: string;
  location: string;
  description: string;
  start_date: string;
  end_date: string;
  attendance_eval_days: number;
  exam_day_number: number;
  days_of_operation: string[];
  excluded_dates: string[];
  attendance_threshold: number;
  status: "upcoming" | "active" | "completed" | "cancelled";
  tuition_fee: number;
  created_at: string;
}

interface EventCalendarEntry {
  calendar_date: string;
  day_number: number;
  is_exam_day: boolean;
  day_of_week: string;
}

interface KenyanHoliday {
  holiday_date: string;
  name: string;
}

const EMPTY_FORM = {
  name: "",
  location: "",
  description: "",
  start_date: "",
  end_date: "",
  attendance_eval_days: 12,
  exam_day_number: 13,
  days_of_operation: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  excluded_dates_text: "", // comma separated
  attendance_threshold: 80,
  tuition_fee: 0,
};

const statusConfig: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  active: { label: "Active", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  completed: { label: "Completed", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function TuitionEventManager({ adminId }: { adminId: string }) {
  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TuitionEvent | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventCalendars, setEventCalendars] = useState<Record<string, EventCalendarEntry[]>>({});
  const [generatingCalendar, setGeneratingCalendar] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<KenyanHoliday[]>([]);

  useEffect(() => {
    fetchEvents();
    fetchHolidays();
  }, []);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  async function fetchHolidays() {
    const { data } = await supabase
      .from("kenyan_holidays")
      .select("holiday_date, name")
      .order("holiday_date");
    if (data) setHolidays(data);
  }

  async function fetchEvents() {
    setLoading(true);
    const { data } = await supabase
      .from("tuition_events")
      .select("*")
      .order("start_date", { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }

  async function fetchEventCalendar(eventId: string) {
    if (eventCalendars[eventId]) return;
    const { data } = await supabase
      .from("event_calendar")
      .select("*")
      .eq("event_id", eventId)
      .order("day_number");
    if (data) {
      setEventCalendars(prev => ({ ...prev, [eventId]: data }));
    }
  }

  function toggleExpand(eventId: string) {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(eventId);
      fetchEventCalendar(eventId);
    }
  }

  /** Generate valid attendance dates for an event */
  async function generateCalendar(event: TuitionEvent) {
    setGeneratingCalendar(event.id);
    setError("");
    setSuccess("");

    try {
      // Clear existing calendar
      await supabase.from("event_calendar").delete().eq("event_id", event.id);

      const holidayDates = new Set(holidays.map(h => h.holiday_date));
      const excludedDates = new Set(event.excluded_dates || []);
      const operatingDays = new Set(event.days_of_operation);

      const entries: Omit<EventCalendarEntry & { event_id: string }, never>[] = [];
      let dayNumber = 0;
      
      // Use UTC midnight for internal processing to match Supabase DATE type
      const current = new Date(event.start_date);
      const endDate = new Date(event.end_date);

      while (current <= endDate) {
        const dayName = current.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        const dateStr = current.toISOString().split("T")[0];

        if (
          operatingDays.has(dayName) &&
          !holidayDates.has(dateStr) &&
          !excludedDates.has(dateStr)
        ) {
          dayNumber++;
          const isExamDay = dayNumber === event.exam_day_number;
          entries.push({
            event_id: event.id,
            calendar_date: dateStr,
            day_number: dayNumber,
            is_exam_day: isExamDay,
            day_of_week: dayName,
          });
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      if (entries.length > 0) {
        const { error: insertError } = await supabase
          .from("event_calendar")
          .insert(entries);
        if (insertError) throw insertError;
      }

      // Refresh calendar cache
      setEventCalendars(prev => {
        const updated = { ...prev };
        delete updated[event.id];
        return updated;
      });
      await fetchEventCalendar(event.id);
      setSuccess(`Calendar generated: ${entries.length} days total`);
    } catch (e: any) {
      setError("Failed to generate calendar: " + e.message);
    } finally {
      setGeneratingCalendar(null);
    }
  }

  function startCreate() {
    setEditingEvent(null);
    setFormData(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function startEdit(event: TuitionEvent) {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      location: event.location || "",
      description: event.description || "",
      start_date: event.start_date,
      end_date: event.end_date,
      attendance_eval_days: event.attendance_eval_days,
      exam_day_number: event.exam_day_number,
      days_of_operation: event.days_of_operation,
      excluded_dates_text: (event.excluded_dates || []).join(", "),
      attendance_threshold: event.attendance_threshold,
      tuition_fee: event.tuition_fee || 0,
    });
    setError("");
    setShowForm(true);
  }

  function toggleDay(day: string) {
    setFormData(prev => ({
      ...prev,
      days_of_operation: prev.days_of_operation.includes(day)
        ? prev.days_of_operation.filter(d => d !== day)
        : [...prev.days_of_operation, day],
    }));
  }

  async function handleSubmit() {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      setError("Event name, start date, and end date are required.");
      return;
    }
    if (formData.days_of_operation.length === 0) {
      setError("Select at least one day of operation.");
      return;
    }
    setSubmitting(true);
    setError("");

    const excluded = formData.excluded_dates_text
      .split(",")
      .map(d => d.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name,
      location: formData.location,
      description: formData.description,
      start_date: formData.start_date,
      end_date: formData.end_date,
      attendance_eval_days: formData.attendance_eval_days,
      exam_day_number: formData.exam_day_number,
      days_of_operation: formData.days_of_operation,
      excluded_dates: excluded,
      attendance_threshold: formData.attendance_threshold,
      tuition_fee: formData.tuition_fee,
      created_by: adminId,
    };

    let error: any;
    if (editingEvent) {
      ({ error } = await supabase
        .from("tuition_events")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingEvent.id));
    } else {
      ({ error } = await supabase.from("tuition_events").insert(payload));
    }

    if (error) {
      setError(error.message);
    } else {
      setShowForm(false);
      setEditingEvent(null);
      fetchEvents();
    }
    setSubmitting(false);
  }

  async function handleDelete(eventId: string) {
    if (!confirm("Delete this tuition event? This will also remove its calendar and attendance records.")) return;
    await supabase.from("tuition_events").delete().eq("id", eventId);
    fetchEvents();
  }

  async function handleStatusChange(eventId: string, newStatus: string) {
    await supabase
      .from("tuition_events")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", eventId);
    fetchEvents();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Tuition Events</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage tuition programs (April, August, December)
          </p>
        </div>
        <Button onClick={startCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Event
        </Button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              {editingEvent ? "Edit Event" : "Create New Tuition Event"}
            </h3>
            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-muted rounded-lg">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event Name *</Label>
              <Input
                placeholder="e.g., April Tuition 2026"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="bg-muted border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                placeholder="e.g., Main Campus"
                value={formData.location}
                onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                className="bg-muted border-border/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
                className="bg-muted border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))}
                className="bg-muted border-border/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Attendance Eval Days</Label>
              <Input
                type="number"
                min={1}
                value={formData.attendance_eval_days}
                onChange={e => setFormData(p => ({ ...p, attendance_eval_days: parseInt(e.target.value) || 12 }))}
                className="bg-muted border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Exam Day Number</Label>
              <Input
                type="number"
                min={1}
                value={formData.exam_day_number}
                onChange={e => setFormData(p => ({ ...p, exam_day_number: parseInt(e.target.value) || 13 }))}
                className="bg-muted border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Threshold (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.attendance_threshold}
                onChange={e => setFormData(p => ({ ...p, attendance_threshold: parseFloat(e.target.value) || 80 }))}
                className="bg-muted border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Tuition Fee (KSh)</Label>
              <Input
                type="number"
                min={0}
                value={formData.tuition_fee}
                onChange={e => setFormData(p => ({ ...p, tuition_fee: parseFloat(e.target.value) || 0 }))}
                className="bg-muted border-border/50 font-bold text-emerald-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Days of Operation *</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    formData.days_of_operation.includes(day)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border/50 hover:border-primary/50"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Custom Excluded Dates</Label>
            <Input
              placeholder="e.g., 2026-04-05, 2026-04-10 (comma-separated)"
              value={formData.excluded_dates_text}
              onChange={e => setFormData(p => ({ ...p, excluded_dates_text: e.target.value }))}
              className="bg-muted border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              Kenyan public holidays are excluded automatically. Add custom dates here (YYYY-MM-DD).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Additional notes about this tuition event..."
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={3}
              className="bg-muted border-border/50"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-primary">
              {submitting ? "Saving..." : editingEvent ? "Update Event" : "Create Event"}
            </Button>
          </div>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border/50 rounded-2xl">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Tuition Events Yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create your first tuition event to get started.
          </p>
          <Button onClick={startCreate} className="bg-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const isExpanded = expandedEventId === event.id;
            const cal = eventCalendars[event.id] || [];
            const evalDays = cal.filter(d => !d.is_exam_day);
            const examDay = cal.find(d => d.is_exam_day);

            return (
              <div key={event.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                {/* Event Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-bold text-foreground text-lg">{event.name}</h3>
                        <Badge
                          variant="outline"
                          className={statusConfig[event.status]?.color}
                        >
                          {statusConfig[event.status]?.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {event.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(event.start_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                          {" → "}
                          {new Date(event.end_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {event.attendance_eval_days} eval days · Exam: Day {event.exam_day_number}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => generateCalendar(event)}
                        disabled={generatingCalendar === event.id}
                        title="Generate Attendance Calendar"
                        className="text-primary hover:bg-primary/10"
                      >
                        <RefreshCw className={`w-4 h-4 ${generatingCalendar === event.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(event)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <button
                        onClick={() => toggleExpand(event.id)}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">Change Status:</span>
                    {["upcoming", "active", "completed", "cancelled"].map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(event.id, s)}
                        disabled={event.status === s}
                        className={`text-xs px-2 py-1 rounded-md border transition-all ${
                          event.status === s
                            ? "opacity-40 cursor-not-allowed border-border/30 text-muted-foreground"
                            : "border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expanded Calendar View */}
                {isExpanded && (
                  <div className="border-t border-border/50 p-5 bg-muted/20">
                    {cal.length === 0 ? (
                      <div className="text-center py-6">
                        <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-3">
                          No calendar generated yet. Click the refresh icon to generate attendance dates.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => generateCalendar(event)}
                          disabled={generatingCalendar === event.id}
                          className="bg-primary"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${generatingCalendar === event.id ? "animate-spin" : ""}`} />
                          Generate Calendar
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-foreground">
                            Attendance Calendar ({evalDays.length} evaluation days
                            {examDay ? ` + Exam Day ${event.exam_day_number}` : ""})
                          </h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => generateCalendar(event)}
                            disabled={generatingCalendar === event.id}
                            className="text-xs"
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${generatingCalendar === event.id ? "animate-spin" : ""}`} />
                            Regenerate
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                          {cal.map(day => (
                            <div
                              key={day.calendar_date}
                              className={`text-center p-2 rounded-lg border text-xs ${
                                day.is_exam_day
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                  : "bg-card border-border/50 text-muted-foreground"
                              }`}
                            >
                              <div className="font-bold text-foreground">Day {day.day_number}</div>
                              <div className="text-[10px] mt-0.5">
                                {new Date(day.calendar_date + "T00:00:00").toLocaleDateString("en-KE", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </div>
                              <div className="text-[10px] opacity-70">{day.day_of_week.slice(0, 3)}</div>
                              {day.is_exam_day && (
                                <div className="text-[10px] font-bold text-amber-400 mt-0.5">EXAM</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
