"use client";

import React from "react"

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  CalendarDays,
  Trophy,
  GraduationCap,
  PartyPopper,
  Megaphone,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow, addDays, parseISO } from "date-fns";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Event {
  id: string;
  title: string;
  description: string;
  event_type: "academic" | "sports" | "cultural" | "meeting" | "holiday" | "other";
  start_date: string;
  end_date: string;
  location: string;
  is_mandatory: boolean;
  max_participants: number | null;
  registration_deadline: string | null;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  created_by: string;
  created_at: string;
  registration_count?: number;
  is_registered?: boolean;
}

interface EventManagerProps {
  userRole: "admin" | "teacher" | "student";
  userId: string;
  userName?: string;
}

const eventTypeConfig = {
  academic: { icon: GraduationCap, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  sports: { icon: Trophy, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cultural: { icon: PartyPopper, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  meeting: { icon: Users, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  holiday: { icon: CalendarDays, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  other: { icon: Megaphone, color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function EventManager({ userRole, userId, userName }: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_type: "academic" as Event["event_type"],
    start_date: "",
    end_date: "",
    location: "",
    is_mandatory: false,
    max_participants: "",
    registration_deadline: "",
  });

  const canManageEvents = userRole === "admin" || userRole === "teacher";

  useEffect(() => {
    fetchEvents();
  }, [filter, typeFilter]);

  async function fetchEvents() {
    setLoading(true);
    try {
      let query = supabase.from("events").select("*").order("start_date", { ascending: true });

      if (filter === "upcoming") {
        query = query.gte("start_date", new Date().toISOString());
      } else if (filter === "past") {
        query = query.lt("end_date", new Date().toISOString());
      }

      if (typeFilter !== "all") {
        query = query.eq("event_type", typeFilter);
      }

      const { data: eventsData, error } = await query;

      if (error) throw error;

      // Fetch registration counts and user registration status
      const eventsWithRegistrations = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count } = await supabase
            .from("event_registrations")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id)
            .eq("status", "registered");

          const { data: userReg } = await supabase
            .from("event_registrations")
            .select("id")
            .eq("event_id", event.id)
            .eq("user_id", userId)
            .eq("status", "registered")
            .single();

          return {
            ...event,
            registration_count: count || 0,
            is_registered: !!userReg,
          };
        })
      );

      setEvents(eventsWithRegistrations);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const eventData = {
      title: formData.title,
      description: formData.description,
      event_type: formData.event_type,
      start_date: formData.start_date,
      end_date: formData.end_date || formData.start_date,
      location: formData.location,
      is_mandatory: formData.is_mandatory,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      registration_deadline: formData.registration_deadline || null,
      status: "upcoming" as const,
      created_by: userId,
    };

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from("events")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(eventData);

        if (error) throw error;

        // Create notification
        await supabase.from("notifications").insert({
          type: "general",
          title: "New Event",
          message: `${formData.title} has been scheduled for ${format(parseISO(formData.start_date), "PPP")}`,
          created_by: userId,
        });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchEvents();
    } catch (error) {
      console.error("Error saving event:", error);
    }
  }

  async function handleDelete(eventId: string) {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      fetchEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  }

  async function handleRegister(event: Event) {
    try {
      if (event.is_registered) {
        // Unregister
        const { error } = await supabase
          .from("event_registrations")
          .delete()
          .eq("event_id", event.id)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Register
        const { error } = await supabase.from("event_registrations").insert({
          event_id: event.id,
          user_id: userId,
          user_name: userName || "Unknown",
          status: "registered",
        });

        if (error) throw error;
      }
      fetchEvents();
    } catch (error) {
      console.error("Error updating registration:", error);
    }
  }

  async function handleStatusChange(eventId: string, status: Event["status"]) {
    try {
      const { error } = await supabase
        .from("events")
        .update({ status })
        .eq("id", eventId);

      if (error) throw error;
      fetchEvents();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      description: "",
      event_type: "academic",
      start_date: "",
      end_date: "",
      location: "",
      is_mandatory: false,
      max_participants: "",
      registration_deadline: "",
    });
    setEditingEvent(null);
  }

  function openEditDialog(event: Event) {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      event_type: event.event_type,
      start_date: event.start_date.slice(0, 16),
      end_date: event.end_date?.slice(0, 16) || "",
      location: event.location || "",
      is_mandatory: event.is_mandatory,
      max_participants: event.max_participants?.toString() || "",
      registration_deadline: event.registration_deadline?.slice(0, 16) || "",
    });
    setIsDialogOpen(true);
  }

  function getEventDateLabel(startDate: string) {
    const date = parseISO(startDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (date <= addDays(new Date(), 7)) return format(date, "EEEE");
    return format(date, "MMM d, yyyy");
  }

  function getStatusBadge(status: Event["status"]) {
    const configs = {
      upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      ongoing: "bg-green-500/20 text-green-400 border-green-500/30",
      completed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return configs[status];
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Events Calendar</h2>
          <p className="text-muted-foreground">
            {canManageEvents ? "Manage school events and activities" : "View upcoming events and register"}
          </p>
        </div>

        {canManageEvents && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
              <DialogHeader>
                <DialogTitle>{editingEvent ? "Edit Event" : "Create New Event"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Annual Sports Day"
                    required
                    className="bg-background/50"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the event..."
                    rows={3}
                    className="bg-background/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event_type">Event Type</Label>
                    <Select
                      value={formData.event_type}
                      onValueChange={(value) => setFormData({ ...formData, event_type: value as Event["event_type"] })}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="cultural">Cultural</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="holiday">Holiday</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Main Auditorium"
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date & Time</Label>
                    <Input
                      id="start_date"
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      className="bg-background/50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="end_date">End Date & Time</Label>
                    <Input
                      id="end_date"
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max_participants">Max Participants</Label>
                    <Input
                      id="max_participants"
                      type="number"
                      value={formData.max_participants}
                      onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                      placeholder="Unlimited"
                      className="bg-background/50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="registration_deadline">Registration Deadline</Label>
                    <Input
                      id="registration_deadline"
                      type="datetime-local"
                      value={formData.registration_deadline}
                      onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_mandatory"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    className="rounded border-border"
                  />
                  <Label htmlFor="is_mandatory" className="cursor-pointer">
                    Mandatory attendance
                  </Label>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary">
                    {editingEvent ? "Update" : "Create"} Event
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex bg-card/50 rounded-lg p-1 border border-border">
          {["upcoming", "all", "past"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 bg-card/50 border-border">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="academic">Academic</SelectItem>
            <SelectItem value="sports">Sports</SelectItem>
            <SelectItem value="cultural">Cultural</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="holiday">Holiday</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card/50 border-border animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="bg-card/50 border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No Events Found</h3>
            <p className="text-muted-foreground text-center">
              {canManageEvents
                ? "Create your first event to get started"
                : "Check back later for upcoming events"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const TypeIcon = eventTypeConfig[event.event_type]?.icon || Calendar;
            const typeColor = eventTypeConfig[event.event_type]?.color || "";
            const isFull = event.max_participants && event.registration_count! >= event.max_participants;
            const deadlinePassed = event.registration_deadline && isPast(parseISO(event.registration_deadline));

            return (
              <Card
                key={event.id}
                className={`bg-card/50 border-border hover:border-primary/50 transition-all ${
                  event.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${typeColor}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline" className={typeColor}>
                        {event.event_type}
                      </Badge>
                    </div>
                    <Badge variant="outline" className={getStatusBadge(event.status)}>
                      {event.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{getEventDateLabel(event.start_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{format(parseISO(event.start_date), "h:mm a")}</span>
                      {event.end_date && event.end_date !== event.start_date && (
                        <span>- {format(parseISO(event.end_date), "h:mm a")}</span>
                      )}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {event.registration_count} registered
                        {event.max_participants && ` / ${event.max_participants} max`}
                      </span>
                    </div>
                  </div>

                  {event.is_mandatory && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      Mandatory
                    </Badge>
                  )}

                  <div className="flex gap-2 pt-2">
                    {userRole === "student" && event.status === "upcoming" && (
                      <Button
                        size="sm"
                        variant={event.is_registered ? "outline" : "default"}
                        onClick={() => handleRegister(event)}
                        disabled={!event.is_registered && (isFull || deadlinePassed)}
                        className={event.is_registered ? "bg-transparent" : "bg-primary"}
                      >
                        {event.is_registered ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Registered
                          </>
                        ) : isFull ? (
                          "Event Full"
                        ) : deadlinePassed ? (
                          "Deadline Passed"
                        ) : (
                          "Register"
                        )}
                      </Button>
                    )}

                    {canManageEvents && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(event)}
                          className="bg-transparent"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {userRole === "admin" && (
                          <>
                            <Select
                              value={event.status}
                              onValueChange={(value) => handleStatusChange(event.id, value as Event["status"])}
                            >
                              <SelectTrigger className="h-9 w-28 bg-transparent">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="upcoming">Upcoming</SelectItem>
                                <SelectItem value="ongoing">Ongoing</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(event.id)}
                              className="bg-transparent text-red-400 hover:text-red-300 hover:border-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
