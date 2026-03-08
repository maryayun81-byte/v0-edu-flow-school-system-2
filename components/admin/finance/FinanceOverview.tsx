"use client";

import { useMemo } from "react";
import { TrendingUp, Users, AlertTriangle, CheckCircle, Clock, DollarSign, Zap, Brain } from "lucide-react";
import type { Payment, TuitionEvent, Student } from "./types";

interface Props {
  payments: Payment[];
  events: TuitionEvent[];
  students: Student[];
}

function fmt(n: number) {
  return `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

export default function FinanceOverview({ payments, events, students }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const stats = useMemo(() => {
    const paid = payments.filter(p => p.status === "paid");
    const totalRevenue = paid.reduce((s, p) => s + p.amount, 0);
    const todayPayments = paid.filter(p => p.payment_date === today).reduce((s, p) => s + p.amount, 0);
    const weekPayments = paid.filter(p => p.payment_date >= weekAgo).reduce((s, p) => s + p.amount, 0);
    const outstanding = payments.filter(p => p.status === "pending" || p.status === "partial").reduce((s, p) => s + p.amount, 0);
    const paidStudents = new Set(paid.map(p => p.student_id)).size;
    const pendingStudents = new Set(payments.filter(p => p.status !== "paid").map(p => p.student_id)).size;
    const mpesaCount = paid.filter(p => p.payment_method === "mpesa").length;
    const mpesaPct = paid.length > 0 ? Math.round((mpesaCount / paid.length) * 100) : 0;

    // Active event completion
    const activeEvent = events.find(e => e.status === "active");
    let activeEventPct = 0;
    if (activeEvent) {
      const eventPaid = paid.filter(p => p.event_id === activeEvent.id);
      const eventStudents = new Set(eventPaid.map(p => p.student_id)).size;
      activeEventPct = students.length > 0 ? Math.round((eventStudents / students.length) * 100) : 0;
    }

    return { totalRevenue, todayPayments, weekPayments, outstanding, paidStudents, pendingStudents, mpesaPct, activeEvent, activeEventPct };
  }, [payments, events, students, today, weekAgo]);

  const insights = useMemo(() => {
    const list: { icon: any; color: string; text: string }[] = [];
    if (stats.activeEvent) {
      list.push({ icon: TrendingUp, color: "text-emerald-400", text: `${stats.activeEventPct}% of students paid for ${stats.activeEvent.name}.` });
    }
    if (stats.mpesaPct > 0) {
      list.push({ icon: Brain, color: "text-blue-400", text: `M-Pesa is the preferred payment method (${stats.mpesaPct}% of transactions).` });
    }
    if (stats.pendingStudents > 0) {
      list.push({ icon: AlertTriangle, color: "text-amber-400", text: `${stats.pendingStudents} student(s) still have outstanding balances totalling ${fmt(stats.outstanding)}.` });
    }
    if (stats.todayPayments > 0) {
      list.push({ icon: Zap, color: "text-purple-400", text: `${fmt(stats.todayPayments)} collected today across all events.` });
    }
    if (payments.length === 0) {
      list.push({ icon: Clock, color: "text-muted-foreground", text: "No payments recorded yet. Start by recording a payment." });
    }
    return list;
  }, [stats, payments.length]);

  const summaryCards = [
    { label: "Total Revenue", value: fmt(stats.totalRevenue), icon: DollarSign, color: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-500/20" },
    { label: "Payments Today", value: fmt(stats.todayPayments), icon: Zap, color: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/20" },
    { label: "This Week", value: fmt(stats.weekPayments), icon: TrendingUp, color: "from-blue-500 to-cyan-600", shadow: "shadow-blue-500/20" },
    { label: "Outstanding", value: fmt(stats.outstanding), icon: AlertTriangle, color: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/20" },
    { label: "Students Paid", value: stats.paidStudents.toString(), icon: CheckCircle, color: "from-green-500 to-emerald-600", shadow: "shadow-green-500/20" },
    { label: "Students Pending", value: stats.pendingStudents.toString(), icon: Clock, color: "from-red-500 to-rose-600", shadow: "shadow-red-500/20" },
    { label: "Total Records", value: payments.length.toString(), icon: Users, color: "from-slate-500 to-gray-600", shadow: "" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="relative bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 overflow-hidden group hover:border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-lg ${card.shadow}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-foreground leading-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* AI Insights */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Financial Insights</h3>
            <p className="text-xs text-muted-foreground">Auto-generated from your payment data</p>
          </div>
        </div>
        <div className="grid gap-3">
          {insights.map((insight, i) => {
            const Icon = insight.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 bg-muted/30 border border-border/30 rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${insight.color}`} />
                <p className="text-sm text-foreground/90">{insight.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
