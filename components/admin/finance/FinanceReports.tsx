"use client";

import { useState } from "react";
import { FileDown, FileText, TrendingUp, AlertTriangle, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Payment, TuitionEvent, Student } from "./types";

interface Props {
  payments: Payment[];
  events: TuitionEvent[];
  students: Student[];
}

function fmt(n: number) { return `KSh ${n.toLocaleString()}`; }

const REPORTS = [
  { id: "revenue",    label: "Revenue Report",         icon: TrendingUp, desc: "All payments with breakdown by method and event" },
  { id: "events",     label: "Event Financial Summary",icon: FileText,   desc: "Revenue collected per tuition event" },
  { id: "outstanding",label: "Outstanding Balances",   icon: AlertTriangle, desc: "Students with pending/partial payments" },
  { id: "students",   label: "Student Payment Status", icon: Users,      desc: "Full payment history for all students" },
];

function generateCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function FinanceReports({ payments, events, students }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);

  function exportReport(reportId: string) {
    setGenerating(reportId);
    const paid = payments.filter(p => p.status === "paid");

    if (reportId === "revenue") {
      const rows = [
        ["Date", "Student", "Admission No.", "Event", "Type", "Amount (KSh)", "Method", "Reference", "Status"],
        ...payments.map(p => [
          p.payment_date, p.student_name, p.student_admission || "",
          p.event_name || "", p.payment_type, String(p.amount),
          p.payment_method, p.transaction_ref || "", p.status,
        ]),
      ];
      generateCSV(rows, `PPT_Revenue_Report_${new Date().toISOString().split("T")[0]}.csv`);
    }

    if (reportId === "events") {
      const rows = [["Event", "Total Collected (KSh)", "No. of Transactions", "Students Paid"]];
      events.forEach(e => {
        const eventPaid = paid.filter(p => p.event_id === e.id);
        const total = eventPaid.reduce((s, p) => s + p.amount, 0);
        const studentsPaid = new Set(eventPaid.map(p => p.student_id)).size;
        rows.push([e.name, String(total), String(eventPaid.length), String(studentsPaid)]);
      });
      generateCSV(rows, `PPT_Event_Summary_${new Date().toISOString().split("T")[0]}.csv`);
    }

    if (reportId === "outstanding") {
      const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "partial");
      const rows = [
        ["Student", "Admission No.", "Event", "Amount (KSh)", "Status", "Date"],
        ...pendingPayments.map(p => [p.student_name, p.student_admission || "", p.event_name || "", String(p.amount), p.status, p.payment_date]),
      ];
      generateCSV(rows, `PPT_Outstanding_Balances_${new Date().toISOString().split("T")[0]}.csv`);
    }

    if (reportId === "students") {
      const rows = [["Student", "Admission No.", "Total Paid (KSh)", "No. of Payments", "Last Payment Date"]];
      students.forEach(s => {
        const sp = paid.filter(p => p.student_id === s.id);
        const total = sp.reduce((sum, p) => sum + p.amount, 0);
        const lastDate = sp.length > 0 ? sp.sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0].payment_date : "—";
        rows.push([s.full_name, s.admission_number, String(total), String(sp.length), lastDate]);
      });
      generateCSV(rows, `PPT_Student_Payment_Status_${new Date().toISOString().split("T")[0]}.csv`);
    }

    setGenerating(null);
  }

  const totalRevenue = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = payments.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{fmt(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{fmt(outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-black text-foreground mt-1">{payments.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Events Tracked</p>
            <p className="text-2xl font-black text-foreground mt-1">{events.length}</p>
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map(report => {
          const Icon = report.icon;
          return (
            <div key={report.id} className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6 space-y-4 hover:border-border transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">{report.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{report.desc}</p>
                </div>
              </div>
              <Button
                onClick={() => exportReport(report.id)}
                disabled={generating === report.id}
                className="w-full h-9 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-medium"
              >
                {generating === report.id ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><FileDown className="w-3.5 h-3.5 mr-2" />Export as CSV</>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Reports export as CSV files. Open with Excel, Google Sheets, or any spreadsheet application.
      </p>
    </div>
  );
}
