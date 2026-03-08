"use client";

import React from "react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Receipt as ReceiptIcon,
  Search,
  Download,
  Eye,
  X,
  FileText,
  Filter,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import PremiumReceiptTemplate from "./finance/PremiumReceiptTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const supabase = createClient();

interface Payment {
  id: string;
  student_id: string;
  student_name: string;
  student_admission: string;
  event_name: string | null;
  amount: number;
  payment_type: string;
  payment_method: string;
  payment_date: string;
  status: "paid" | "pending" | "partial" | "refunded";
  transaction_ref: string | null;
  receipt_number: string | null;
  created_at: string;
}

interface Receipt {
  id: string;
  receipt_number: string;
  student_id: string;
  student_name: string;
  event_name: string | null;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
  remaining_balance: number;
  status: string;
  published_at: string | null;
  created_at: string;
}

interface TuitionManagerProps {
  userRole: "admin" | "teacher" | "student";
  userId: string;
  studentAdmissionNumber?: string;
}

const paymentTypeLabels: Record<string, string> = {
  tuition_fee: "Tuition Fee",
  deposit: "Deposit",
  balance_payment: "Balance Payment",
  materials: "Materials",
  other: "Other",
};

const statusConfig = {
  paid: { icon: CheckCircle, color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Paid" },
  pending: { icon: Clock, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Pending" },
  partial: { icon: AlertTriangle, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Partial" },
  refunded: { icon: X, color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Refunded" },
};

export default function TuitionManager({ userRole, userId, studentAdmissionNumber }: TuitionManagerProps) {
  const [activeTab, setActiveTab] = useState<"payments" | "receipts">("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [preview, setPreview] = useState<Receipt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchData();
  }, [userId]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("ppt_payments")
        .select("*")
        .eq("student_id", userId)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      const { data: receiptsData, error: receiptsError } = await supabase
        .from("ppt_receipts")
        .select("*")
        .eq("student_id", userId)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (receiptsError) throw receiptsError;
      setReceipts(receiptsData || []);
    } catch (error) {
      console.error("Error fetching finance data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPDF(r: Receipt) {
    setIsGenerating(true);
    try {
      const element = document.getElementById("premium-receipt-capture");
      if (!element) return;

      // Ensure element is visible for capture but not to user
      element.style.display = "block";
      element.style.position = "absolute";
      element.style.left = "-9999px";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${r.receipt_number}.pdf`);
      
      element.style.display = "none";
    } catch (error) {
      console.error("PDF Generation Error:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  // Get unique event names for filter
  const uniqueEvents = Array.from(new Set(payments.map(p => p.event_name).filter(Boolean)));

  // Calculate summary stats
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = payments.filter((p) => p.status === "pending" || p.status === "partial").reduce((sum, p) => sum + p.amount, 0);
  const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = searchQuery === "" ||
      (p.event_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.transaction_ref || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.receipt_number || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEvent = eventFilter === "all" || p.event_name === eventFilter;
    return matchesSearch && matchesEvent;
  });

  const filteredReceipts = receipts.filter((r) => {
    const matchesSearch = searchQuery === "" ||
      r.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.event_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.transaction_ref || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEvent = eventFilter === "all" || r.event_name === eventFilter;
    return matchesSearch && matchesEvent;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Fees & Finance</h2>
          <p className="text-muted-foreground text-sm">View your payment history and official receipts</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KSh {totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{payments.length} Records found</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">KSh {paidAmount.toLocaleString()}</div>
            <Progress value={collectionRate} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{collectionRate.toFixed(1)}% Completed</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">KSh {pendingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending clearance</p>
          </CardContent>
        </Card>
      </div>

      {/* Internal Tabs */}
      <div className="flex gap-1 p-1 bg-muted/40 border border-border/50 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "payments" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Payment Records
        </button>
        <button
          onClick={() => setActiveTab("receipts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "receipts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          My Receipts
          {receipts.length > 0 && (
            <span className="w-5 h-5 bg-primary/20 text-primary text-[10px] rounded-full flex items-center justify-center font-bold">
              {receipts.length}
            </span>
          )}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border h-11"
          />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
           <Filter className="w-4 h-4 text-muted-foreground" />
           <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="bg-card/50 border-border h-11">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {uniqueEvents.map(e => e && <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
           </Select>
        </div>
      </div>

      {/* Content Area */}
      <Card className="bg-card/50 border-border overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-2">Loading financial records...</p>
            </div>
          ) : activeTab === "payments" ? (
            filteredPayments.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Payments Found</h3>
                <p className="text-muted-foreground">Your payment history will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent bg-muted/20">
                      <TableHead>Event / Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method & Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => {
                      const StatusIcon = statusConfig[p.status]?.icon || Clock;
                      return (
                        <TableRow key={p.id} className="border-border hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-semibold">{p.event_name || "General Payment"}</p>
                              <p className="text-xs text-muted-foreground">{paymentTypeLabels[p.payment_type] || p.payment_type}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            KSh {p.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{p.payment_method.toUpperCase()}</p>
                            <p className="text-xs font-mono text-muted-foreground">{p.transaction_ref || p.receipt_number || "—"}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(p.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusConfig[p.status]?.color} border-transparent px-2.5 py-0.5`}>
                              <StatusIcon className="h-3 w-3 mr-1.5" />
                              {statusConfig[p.status]?.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            /* Receipts List */
            filteredReceipts.length === 0 ? (
              <div className="p-12 text-center">
                <ReceiptIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No Receipts Published</h3>
                <p className="text-muted-foreground">Your official receipts will appear here once published by admin.</p>
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {filteredReceipts.map((r) => (
                  <div key={r.id} className="group relative bg-muted/30 border border-border/50 rounded-2xl p-5 hover:border-primary/50 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Official Receipt</p>
                        <h4 className="font-bold text-lg font-mono">{r.receipt_number}</h4>
                        <p className="text-xs text-muted-foreground">{r.event_name || "General Payment"}</p>
                      </div>
                      <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <ReceiptIcon className="w-5 h-5" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid Amount:</span>
                        <span className="font-bold text-foreground font-mono">KSh {r.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Method:</span>
                        <span className="text-foreground">{r.payment_method.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="text-blue-400 font-bold">KSh {r.remaining_balance.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 bg-background/50 hover:bg-background border border-border/50 h-10 text-xs"
                        onClick={() => setPreview(r)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-2" />
                        Preview
                      </Button>
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-10 text-xs shadow-lg shadow-emerald-500/20"
                        onClick={() => downloadPDF(r)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Clock className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
                        PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Receipt Preview Modal */}
      {preview && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto" onClick={() => setPreview(null)}>
      <div className="bg-card border border-border/50 rounded-[2.5rem] max-w-xl w-full my-auto overflow-hidden shadow-2xl scale-in-center animate-in fade-in zoom-in duration-300 relative" onClick={e => e.stopPropagation()}>
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
        
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-6 md:p-10 text-center border-b border-border/50">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-card rounded-3xl flex items-center justify-center shadow-xl mx-auto mb-4 border border-emerald-500/20">
            <ReceiptIcon className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
          </div>
          <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight">Official PPT Receipt</h3>
          <p className="text-xs md:text-sm font-mono text-emerald-500/60 mt-1.5 uppercase tracking-widest font-bold">{preview.receipt_number}</p>
        </div>
        <div className="p-6 md:p-10 space-y-5 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[
              ["Student", preview.student_name],
              ["Purpose", preview.event_name || "Tuition/General"],
              ["Amount", `KSh ${preview.amount.toLocaleString()}`],
              ["Method", preview.payment_method.toUpperCase()],
              ["Date", new Date(preview.payment_date).toLocaleDateString()],
              ["Reference", preview.transaction_ref || "—"],
              ["Balance", `KSh ${preview.remaining_balance.toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={label} className="bg-muted/30 p-4 rounded-2xl border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-1">{label}</span>
                <span className="font-bold text-foreground text-sm line-clamp-1">{value}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => downloadPDF(preview)} 
              disabled={isGenerating}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-12 md:h-14 rounded-2xl shadow-xl shadow-emerald-500/20 font-bold transition-all hover:scale-[1.02]"
            >
              {isGenerating ? <Clock className="w-5 h-5 mr-2 animate-spin" /> : <Download className="w-5 h-5 mr-2" />}
              Download Official PDF
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)} className="h-12 md:h-14 md:px-6 rounded-2xl border-border/50 bg-background/50 font-bold">
              Close Preview
            </Button>
          </div>
        </div>
        <div className="px-10 py-5 bg-muted/40 text-center border-t border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black">Powered by Peak Performance Tutoring Systems</p>
        </div>
      </div>
    </div>
      )}
      {/* Hidden PDF Template for Capture */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
        {preview && <PremiumReceiptTemplate receipt={preview} />}
      </div>
    </div>
  );
}
