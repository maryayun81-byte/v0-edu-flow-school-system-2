"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter, Eye, Receipt, Trash2, CheckCircle, Clock, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Payment, TuitionEvent } from "./types";

const supabase = createClient();

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  partial: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  refunded: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};
const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa", cash: "Cash", bank_transfer: "Bank", card: "Card", other: "Other",
};
const TYPE_LABELS: Record<string, string> = {
  tuition_fee: "Tuition Fee", deposit: "Deposit", balance_payment: "Balance", materials: "Materials", other: "Other",
};

interface Props {
  payments: Payment[];
  events: TuitionEvent[];
  onRefresh: () => void;
  adminId: string;
  onReceiptGenerated: () => void;
}

export default function PaymentRecords({ payments, events, onRefresh, adminId, onReceiptGenerated }: Props) {
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [generating, setGenerating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.student_name.toLowerCase().includes(q) ||
        (p.transaction_ref || "").toLowerCase().includes(q) ||
        (p.event_name || "").toLowerCase().includes(q) ||
        (p.student_admission || "").toLowerCase().includes(q);
      const matchEvent = filterEvent === "all" || p.event_id === filterEvent;
      const matchMethod = filterMethod === "all" || p.payment_method === filterMethod;
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      return matchSearch && matchEvent && matchMethod && matchStatus;
    });
  }, [payments, search, filterEvent, filterMethod, filterStatus]);

  async function generateReceipt(payment: Payment) {
    setGenerating(payment.id);
    const receiptNumber = payment.receipt_number || `PPT-REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await supabase.from("ppt_receipts").upsert({
      receipt_number: receiptNumber,
      payment_id: payment.id,
      student_id: payment.student_id,
      student_name: payment.student_name,
      event_name: payment.event_name,
      amount: payment.amount,
      payment_method: payment.payment_method,
      transaction_ref: payment.transaction_ref,
      payment_date: payment.payment_date,
      remaining_balance: 0,
      status: "draft",
    }, { onConflict: "receipt_number" });
    // Also update the payment with the receipt number
    if (!payment.receipt_number) {
      await supabase.from("ppt_payments").update({ receipt_number: receiptNumber }).eq("id", payment.id);
    }
    setGenerating(null);
    onReceiptGenerated();
  }

  async function deletePayment(id: string) {
    if (!confirm("Delete this payment record?")) return;
    await supabase.from("ppt_payments").delete().eq("id", id);
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search student, reference, event..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-muted border-border/50 h-9" />
          </div>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-44 bg-muted border-border/50 h-9"><SelectValue placeholder="All Events" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-36 bg-muted border-border/50 h-9"><SelectValue placeholder="All Methods" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {Object.entries(METHOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 bg-muted border-border/50 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} of {payments.length} records</p>
      </div>

      {/* Table */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No payment records found</td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.student_name}</p>
                      <p className="text-xs text-muted-foreground">{p.student_admission}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">{p.event_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">{TYPE_LABELS[p.payment_type] || p.payment_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">KSh {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.transaction_ref || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.payment_date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[p.status] || ""}`}>
                        {p.status === "paid" ? <CheckCircle className="w-3 h-3" /> : p.status === "pending" ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelected(p)} title="View" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => generateReceipt(p)} disabled={generating === p.id} title="Generate Receipt" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-blue-400 transition-colors disabled:opacity-40">
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deletePayment(p.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">Payment Details</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            {[
              ["Student", selected.student_name], ["Admission No.", selected.student_admission],
              ["Event", selected.event_name || "—"], ["Type", TYPE_LABELS[selected.payment_type] || selected.payment_type],
              ["Amount", `KSh ${selected.amount.toLocaleString()}`],
              ["Method", METHOD_LABELS[selected.payment_method] || selected.payment_method],
              ["Reference", selected.transaction_ref || "—"], ["Date", selected.payment_date],
              ["Receipt No.", selected.receipt_number || "Not generated"],
              ["Notes", selected.notes || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-border/30 last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground text-right ml-4 max-w-[60%] break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
