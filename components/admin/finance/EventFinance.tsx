"use client";

import { useMemo } from "react";
import { CalendarDays, Users, CheckCircle, Clock, TrendingUp } from "lucide-react";
import type { Payment, TuitionEvent, Student } from "./types";

interface Props {
  payments: Payment[];
  events: TuitionEvent[];
  students: Student[];
}

function fmt(n: number) { return `KSh ${n.toLocaleString()}`; }

export default function EventFinance({ payments, events, students }: Props) {
  const eventStats = useMemo(() => {
    return events.map(event => {
      const eventPayments = payments.filter(p => p.event_id === event.id && p.status === "paid");
      const totalCollected = eventPayments.reduce((s, p) => s + p.amount, 0);
      const paidStudentIds = new Set(eventPayments.map(p => p.student_id));
      const studentsPaid = paidStudentIds.size;
      const studentsPending = students.length - studentsPaid;
      const expectedRevenue = event.tuition_fee ? event.tuition_fee * students.length : 0;
      const outstanding = Math.max(0, expectedRevenue - totalCollected);
      const progressPct = expectedRevenue > 0 ? Math.min(100, Math.round((totalCollected / expectedRevenue) * 100)) : (studentsPaid > 0 ? 100 : 0);
      return { event, totalCollected, studentsPaid, studentsPending: Math.max(0, studentsPending), expectedRevenue, outstanding, progressPct, txCount: eventPayments.length };
    });
  }, [events, payments, students]);

  if (events.length === 0) {
    return (
      <div className="bg-card/60 border border-border/50 rounded-2xl p-16 text-center">
        <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-foreground mb-2">No Events Found</h3>
        <p className="text-sm text-muted-foreground">Create tuition events in the Attendance tab first.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {eventStats.map(({ event, totalCollected, studentsPaid, studentsPending, expectedRevenue, outstanding, progressPct, txCount }) => (
        <div key={event.id} className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden hover:border-border transition-all">
          {/* Event Header */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border-b border-border/30 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-foreground text-lg leading-tight">{event.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(event.start_date + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  {" → "}
                  {new Date(event.end_date + "T00:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                event.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                event.status === "upcoming" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
                event.status === "completed" ? "bg-gray-500/15 text-gray-400 border-gray-500/30" :
                "bg-red-500/15 text-red-400 border-red-500/30"
              }`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center bg-muted/30 rounded-xl py-3">
                <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{students.length}</p>
                <p className="text-[10px] text-muted-foreground">Total Students</p>
              </div>
              <div className="text-center bg-emerald-500/10 rounded-xl py-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-400">{studentsPaid}</p>
                <p className="text-[10px] text-muted-foreground">Paid</p>
              </div>
              <div className="text-center bg-amber-500/10 rounded-xl py-3">
                <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-400">{studentsPending}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
            </div>

            {/* Revenue Figures */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Collected</span>
                <span className="font-bold text-emerald-400">{fmt(totalCollected)}</span>
              </div>
              {expectedRevenue > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium text-foreground">{fmt(expectedRevenue)}</span>
                </div>
              )}
              {outstanding > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-medium text-amber-400">{fmt(outstanding)}</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5" /> Collection Progress
                </div>
                <span className="text-xs font-bold text-foreground">{progressPct}%</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{txCount} transaction(s) recorded</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
