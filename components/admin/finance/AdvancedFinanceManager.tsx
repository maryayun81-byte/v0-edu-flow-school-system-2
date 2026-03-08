"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { 
  DollarSign, 
  Plus, 
  List, 
  Receipt as ReceiptIcon, 
  CalendarDays, 
  BarChart2, 
  FileDown, 
  Sparkles,
  ShieldCheck
} from "lucide-react";

import FinanceOverview from "./FinanceOverview";
import RecordPayment from "./RecordPayment";
import PaymentRecords from "./PaymentRecords";
import FinanceReceipts from "./FinanceReceipts";
import EventFinance from "./EventFinance";
import FinanceAnalytics from "./FinanceAnalytics";
import FinanceReports from "./FinanceReports";
import FinanceIntelligenceOverview from "./FinanceIntelligenceOverview";
import FinanceGovernancePanel from "./FinanceGovernancePanel";
import { TuitionEvent, Student, Payment, Receipt } from "./types";

const supabase = createClient();

const TABS = [
  { id: "intelligence", label: "Intelligence", icon: Sparkles },
  { id: "overview",     label: "Overview",     icon: DollarSign },
  { id: "record",       label: "Record Payments", icon: Plus },
  { id: "records",   label: "Payment Records",   icon: List },
  { id: "receipts",  label: "Receipts",          icon: ReceiptIcon },
  { id: "events",    label: "Event Finance",      icon: CalendarDays },
  { id: "analytics", label: "Analytics",         icon: BarChart2 },
  { id: "reports",   label: "Reports & Exports", icon: FileDown },
  { id: "governance", label: "AI Governance",    icon: ShieldCheck },
];

export default function AdvancedFinanceManager({ adminId }: { adminId: string }) {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<TuitionEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [studentsRes, eventsRes, paymentsRes, receiptsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, admission_number, form_class").eq("role", "student").order("full_name"),
        supabase.from("tuition_events").select("id, name, start_date, end_date, status, tuition_fee").order("start_date", { ascending: false }),
        supabase.from("ppt_payments").select("*").order("created_at", { ascending: false }),
        supabase.from("ppt_receipts").select("*").order("created_at", { ascending: false }),
      ]);

      const errors = [studentsRes.error, eventsRes.error, paymentsRes.error, receiptsRes.error].filter(Boolean);
      if (errors.length > 0) {
        console.error("Finance Fetch Errors:", errors);
        toast.error("Failed to load some finance data.");
      }

      setStudents(studentsRes.data || []);
      setEvents(eventsRes.data || []);
      setPayments(paymentsRes.data || []);
      setReceipts(receiptsRes.data || []);
    } catch (err) {
      console.error("Fetch All Error:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 px-1">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Finance Management</h2>
          <p className="text-sm text-muted-foreground">Peak Performance Tutoring – Financial Control Centre</p>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 flex-wrap bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-1.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === "intelligence" && <FinanceIntelligenceOverview />}
          {activeTab === "overview"  && <FinanceOverview payments={payments} events={events} students={students} />}
          {activeTab === "record"    && <RecordPayment adminId={adminId} students={students} events={events} onSuccess={fetchAll} />}
          {activeTab === "records"   && <PaymentRecords payments={payments} events={events} onRefresh={fetchAll} adminId={adminId} onReceiptGenerated={fetchAll} />}
          {activeTab === "receipts"  && <FinanceReceipts receipts={receipts} onRefresh={fetchAll} />}
          {activeTab === "events"    && <EventFinance payments={payments} events={events} students={students} />}
          {activeTab === "analytics" && <FinanceAnalytics payments={payments} events={events} />}
          {activeTab === "reports"   && <FinanceReports payments={payments} events={events} students={students} />}
          {activeTab === "governance" && <FinanceGovernancePanel />}
        </>
      )}
    </div>
  );
}
