"use client";

import React from "react"

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Plus,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Receipt,
  TrendingUp,
  Users,
  Calendar,
  Search,
  FileText,
  CreditCard,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Payment {
  id: string;
  student_id: string;
  student_name: string;
  student_admission_number: string;
  amount: number;
  payment_type: "tuition" | "exam_fee" | "library" | "transport" | "other";
  payment_method: "cash" | "bank_transfer" | "mpesa" | "card" | "other";
  term: string;
  academic_year: string;
  due_date: string;
  paid_date: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  transaction_ref: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

interface TuitionManagerProps {
  userRole: "admin" | "teacher" | "student";
  userId: string;
  studentAdmissionNumber?: string;
}

const paymentTypeLabels = {
  tuition: "Tuition Fee",
  exam_fee: "Exam Fee",
  library: "Library Fee",
  transport: "Transport Fee",
  other: "Other",
};

const statusConfig = {
  pending: { icon: Clock, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Pending" },
  partial: { icon: AlertTriangle, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Partial" },
  paid: { icon: CheckCircle, color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Paid" },
  overdue: { icon: XCircle, color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Overdue" },
};

export default function TuitionManager({ userRole, userId, studentAdmissionNumber }: TuitionManagerProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [students, setStudents] = useState<{ id: string; full_name: string; admission_number: string }[]>([]);

  const [formData, setFormData] = useState({
    student_id: "",
    student_name: "",
    student_admission_number: "",
    amount: "",
    payment_type: "tuition" as Payment["payment_type"],
    payment_method: "bank_transfer" as Payment["payment_method"],
    term: "Term 1",
    academic_year: new Date().getFullYear().toString(),
    due_date: "",
    paid_date: "",
    status: "pending" as Payment["status"],
    transaction_ref: "",
    notes: "",
  });

  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchPayments();
    if (isAdmin) {
      fetchStudents();
    }
  }, [statusFilter, typeFilter]);

  async function fetchStudents() {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, admission_number")
        .eq("role", "student")
        .order("full_name");

      setStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  }

  async function fetchPayments() {
    setLoading(true);
    try {
      let query = supabase
        .from("tuition_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (userRole === "student" && studentAdmissionNumber) {
        query = query.eq("student_admission_number", studentAdmissionNumber);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        query = query.eq("payment_type", typeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Update overdue status
      const updatedPayments = (data || []).map((payment) => {
        if (payment.status === "pending" && payment.due_date && isAfter(new Date(), parseISO(payment.due_date))) {
          return { ...payment, status: "overdue" };
        }
        return payment;
      });

      setPayments(updatedPayments);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const selectedStudent = students.find((s) => s.id === formData.student_id);

    const paymentData = {
      student_id: formData.student_id,
      student_name: selectedStudent?.full_name || formData.student_name,
      student_admission_number: selectedStudent?.admission_number || formData.student_admission_number,
      amount: parseFloat(formData.amount),
      payment_type: formData.payment_type,
      payment_method: formData.payment_method,
      term: formData.term,
      academic_year: formData.academic_year,
      due_date: formData.due_date,
      paid_date: formData.paid_date || null,
      status: formData.status,
      transaction_ref: formData.transaction_ref || null,
      notes: formData.notes || null,
      created_by: userId,
    };

    try {
      const { error } = await supabase.from("tuition_payments").insert(paymentData);

      if (error) throw error;

      // Create notification for student
      if (formData.student_id) {
        await supabase.from("notifications").insert({
          type: "general",
          title: "New Payment Record",
          message: `A ${paymentTypeLabels[formData.payment_type]} of KES ${parseFloat(formData.amount).toLocaleString()} has been recorded.`,
          created_by: userId,
        });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchPayments();
    } catch (error) {
      console.error("Error saving payment:", error);
    }
  }

  async function handleStatusUpdate(paymentId: string, newStatus: Payment["status"], paidDate?: string) {
    try {
      const updateData: Partial<Payment> = { status: newStatus };
      if (newStatus === "paid" && paidDate) {
        updateData.paid_date = paidDate;
      }

      const { error } = await supabase
        .from("tuition_payments")
        .update(updateData)
        .eq("id", paymentId);

      if (error) throw error;
      fetchPayments();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  function resetForm() {
    setFormData({
      student_id: "",
      student_name: "",
      student_admission_number: "",
      amount: "",
      payment_type: "tuition",
      payment_method: "bank_transfer",
      term: "Term 1",
      academic_year: new Date().getFullYear().toString(),
      due_date: "",
      paid_date: "",
      status: "pending",
      transaction_ref: "",
      notes: "",
    });
  }

  // Calculate summary stats
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = payments.filter((p) => p.status === "pending" || p.status === "partial").reduce((sum, p) => sum + p.amount, 0);
  const overdueAmount = payments.filter((p) => p.status === "overdue").reduce((sum, p) => sum + p.amount, 0);
  const collectionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

  const filteredPayments = payments.filter((payment) =>
    searchQuery === "" ||
    payment.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.student_admission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    payment.transaction_ref?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isAdmin ? "Financial Management" : "My Payments"}
          </h2>
          <p className="text-muted-foreground">
            {isAdmin ? "Track tuition and fee payments" : "View your payment history and dues"}
          </p>
        </div>

        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
              <DialogHeader>
                <DialogTitle>Record New Payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="student">Student</Label>
                  <Select
                    value={formData.student_id}
                    onValueChange={(value) => setFormData({ ...formData, student_id: value })}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.full_name} ({student.admission_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (KES)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="50000"
                      required
                      className="bg-background/50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment_type">Payment Type</Label>
                    <Select
                      value={formData.payment_type}
                      onValueChange={(value) => setFormData({ ...formData, payment_type: value as Payment["payment_type"] })}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tuition">Tuition Fee</SelectItem>
                        <SelectItem value="exam_fee">Exam Fee</SelectItem>
                        <SelectItem value="library">Library Fee</SelectItem>
                        <SelectItem value="transport">Transport Fee</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="term">Term</Label>
                    <Select
                      value={formData.term}
                      onValueChange={(value) => setFormData({ ...formData, term: value })}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="academic_year">Academic Year</Label>
                    <Input
                      id="academic_year"
                      value={formData.academic_year}
                      onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                      placeholder="2024"
                      required
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                      className="bg-background/50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as Payment["status"] })}
                    >
                      <SelectTrigger className="bg-background/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.status === "paid" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="paid_date">Paid Date</Label>
                      <Input
                        id="paid_date"
                        type="date"
                        value={formData.paid_date}
                        onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>

                    <div>
                      <Label htmlFor="payment_method">Payment Method</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) => setFormData({ ...formData, payment_method: value as Payment["payment_method"] })}
                      >
                        <SelectTrigger className="bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="transaction_ref">Transaction Reference</Label>
                  <Input
                    id="transaction_ref"
                    value={formData.transaction_ref}
                    onChange={(e) => setFormData({ ...formData, transaction_ref: e.target.value })}
                    placeholder="TXN-12345"
                    className="bg-background/50"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={2}
                    className="bg-background/50"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-transparent">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary">
                    Add Payment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isAdmin ? "Total Expected" : "Total Fees"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {payments.length} payment records
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isAdmin ? "Total Collected" : "Paid"}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">KES {paidAmount.toLocaleString()}</div>
            <Progress value={collectionRate} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {collectionRate.toFixed(1)}% collection rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">KES {pendingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {payments.filter((p) => p.status === "pending" || p.status === "partial").length} pending payments
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">KES {overdueAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {payments.filter((p) => p.status === "overdue").length} overdue payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, admission number, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card/50 border-border">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 bg-card/50 border-border">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="tuition">Tuition</SelectItem>
            <SelectItem value="exam_fee">Exam Fee</SelectItem>
            <SelectItem value="library">Library</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <Card className="bg-card/50 border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-2">Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Payments Found</h3>
              <p className="text-muted-foreground">
                {isAdmin ? "Add a payment record to get started" : "No payment records yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const StatusIcon = statusConfig[payment.status]?.icon || Clock;
                    return (
                      <TableRow key={payment.id} className="border-border">
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.student_name}</p>
                            <p className="text-xs text-muted-foreground">{payment.student_admission_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-transparent">
                            {paymentTypeLabels[payment.payment_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          KES {payment.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {payment.term} {payment.academic_year}
                        </TableCell>
                        <TableCell>
                          {payment.due_date && format(parseISO(payment.due_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[payment.status]?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[payment.status]?.label}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {payment.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(payment.id, "paid", new Date().toISOString().split("T")[0])}
                                className="bg-transparent text-green-400 hover:text-green-300 hover:border-green-400"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Mark Paid
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
