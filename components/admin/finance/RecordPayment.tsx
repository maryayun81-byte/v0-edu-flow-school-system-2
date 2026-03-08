"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Plus, Trash2, CheckSquare, Square, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Student, TuitionEvent } from "./types";

const supabase = createClient();

interface Props {
  adminId: string;
  students: Student[];
  events: TuitionEvent[];
  onSuccess: () => void;
}

const PAYMENT_TYPES = [
  { value: "tuition_fee", label: "Tuition Fee" },
  { value: "deposit", label: "Deposit" },
  { value: "balance_payment", label: "Balance Payment" },
  { value: "materials", label: "Materials" },
  { value: "other", label: "Other" },
];
const PAYMENT_METHODS = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PPT-REC-${year}-${rand}`;
}

export default function RecordPayment({ adminId, students, events, onSuccess }: Props) {
  const [search, setSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [form, setForm] = useState({
    event_id: "",
    payment_type: "tuition_fee",
    amount: "",
    payment_method: "mpesa",
    transaction_ref: "",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dupWarning, setDupWarning] = useState(false);

  const filteredStudents = useMemo(() =>
    students.filter(s =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.admission_number || "").toLowerCase().includes(search.toLowerCase())
    ), [students, search]);

  function toggleStudent(id: string) {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function checkDuplicate(ref: string) {
    if (!ref) { setDupWarning(false); return; }
    const { data } = await supabase.from("ppt_payments").select("id").eq("transaction_ref", ref).limit(1);
    setDupWarning(!!(data && data.length > 0));
  }

  async function handleSubmit() {
    if (selectedStudents.length === 0) { setError("Select at least one student."); return; }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setError("Enter a valid amount."); return; }
    if (dupWarning) { setError("Duplicate M-Pesa reference code detected. Please verify."); return; }
    setSubmitting(true);
    setError("");

    const selectedEvent = events.find(e => e.id === form.event_id);

    const rows = selectedStudents.map(sid => {
      const student = students.find(s => s.id === sid)!;
      return {
        student_id: sid,
        student_name: student.full_name,
        student_admission: student.admission_number,
        event_id: form.event_id || null,
        event_name: selectedEvent?.name || null,
        payment_type: form.payment_type,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        transaction_ref: form.transaction_ref || null,
        payment_date: form.payment_date,
        notes: form.notes || null,
        status: "paid",
        receipt_number: generateReceiptNumber(),
        created_by: adminId,
      };
    });

    const { error: err } = await supabase.from("ppt_payments").insert(rows);
    setSubmitting(false);
    if (err) { setError(err.message); return; }

    setSuccess(`${rows.length} payment(s) recorded successfully!`);
    setSelectedStudents([]);
    setForm({ event_id: "", payment_type: "tuition_fee", amount: "", payment_method: "mpesa", transaction_ref: "", payment_date: new Date().toISOString().split("T")[0], notes: "" });
    setSearch("");
    onSuccess();
    setTimeout(() => setSuccess(""), 5000);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Student Selector */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-bold text-foreground mb-1">Select Students</h3>
          <p className="text-xs text-muted-foreground">Choose one or multiple students (e.g. siblings)</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or admission number..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-muted border-border/50 h-10" />
        </div>
        {selectedStudents.length > 0 && (
          <div className="flex items-center justify-between text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <span className="text-emerald-400 font-medium">{selectedStudents.length} student(s) selected</span>
            <button onClick={() => setSelectedStudents([])} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="max-h-80 overflow-y-auto space-y-1 custom-scrollbar">
          {filteredStudents.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No students found</p>
          )}
          {filteredStudents.map(s => {
            const selected = selectedStudents.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleStudent(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${selected ? "bg-emerald-500/10 border-emerald-500/30" : "hover:bg-muted/50 border-transparent"}`}
              >
                {selected ? <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.admission_number} {s.form_class ? `· ${s.form_class}` : ""}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Form */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-bold text-foreground mb-1">Payment Details</h3>
          <p className="text-xs text-muted-foreground">Fill in the payment information below</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2.5 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-3 py-2.5 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
          </div>
        )}
        {dupWarning && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-3 py-2.5 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> Duplicate M-Pesa reference detected!
          </div>
        )}

        <div className="space-y-2">
          <Label>Tuition Event</Label>
          <Select value={form.event_id} onValueChange={v => setForm(p => ({ ...p, event_id: v }))}>
            <SelectTrigger className="bg-muted border-border/50 h-11 text-foreground">
              <SelectValue placeholder={events.length === 0 ? "No active events found" : "Select event (optional)"} />
            </SelectTrigger>
            <SelectContent>
              {events.length === 0 ? (
                <div className="py-6 px-4 text-center text-sm text-muted-foreground">
                  No active tuition events available.
                </div>
              ) : (
                events.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{e.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">Status: {e.status}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Payment Type *</Label>
            <Select value={form.payment_type} onValueChange={v => setForm(p => ({ ...p, payment_type: v }))}>
              <SelectTrigger className="bg-muted border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (KSh) *</Label>
            <Input type="number" placeholder="e.g. 15000" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="bg-muted border-border/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Payment Method *</Label>
            <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}>
              <SelectTrigger className="bg-muted border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payment Date *</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} className="bg-muted border-border/50" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Transaction / M-Pesa Reference</Label>
          <Input
            placeholder="e.g. RKS7F8H2LP"
            value={form.transaction_ref}
            onChange={e => { setForm(p => ({ ...p, transaction_ref: e.target.value })); checkDuplicate(e.target.value); }}
            className={`bg-muted border-border/50 uppercase tracking-widest ${dupWarning ? "border-amber-500/70" : ""}`}
          />
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="bg-muted border-border/50 resize-none" />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedStudents.length === 0}
          className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold disabled:opacity-50"
        >
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording...</> : <><Plus className="w-4 h-4 mr-2" />Record Payment{selectedStudents.length > 1 ? ` for ${selectedStudents.length} Students` : ""}</>}
        </Button>
      </div>
    </div>
  );
}
