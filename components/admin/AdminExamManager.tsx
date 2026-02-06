"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Lock,
  AlertCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Exam {
  id: string;
  exam_name: string;
  academic_year: number;
  term: string;
  start_date: string;
  end_date: string;
  status: "Draft" | "Active" | "Closed" | "Finalized";
  system_type: "CBC" | "8-4-4" | "Combined";
  applicable_classes: string[];
  created_at: string;
  updated_at: string;
}

interface Class {
  id: string;
  name: string;
  form_level: string;
}

const TERMS = ["Term 1", "Term 2", "Term 3"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function AdminExamManager() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Form state
  const [examName, setExamName] = useState("");
  const [academicYear, setAcademicYear] = useState(CURRENT_YEAR.toString());
  const [term, setTerm] = useState("");
  const [systemType, setSystemType] = useState<"CBC" | "8-4-4" | "Combined">("8-4-4");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, []);

  async function fetchData() {
    try {
      const [examsRes, classesRes] = await Promise.all([
        supabase
          .from("exams")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("classes")
          .select("id, name, form_level")
          .order("form_level", { ascending: true }),
      ]);

      if (examsRes.data) setExams(examsRes.data);
      if (classesRes.data) setClasses(classesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel("admin-exams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exams" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function resetForm() {
    setExamName("");
    setAcademicYear(CURRENT_YEAR.toString());
    setTerm("");
    setStartDate("");
    setEndDate("");
    setSelectedClasses([]);
    setSystemType("8-4-4");
    setEditingExam(null);
  }

  function openEditModal(exam: Exam) {
    setEditingExam(exam);
    setExamName(exam.exam_name);
    setAcademicYear(exam.academic_year.toString());
    setTerm(exam.term);
    setStartDate(exam.start_date);
    setEndDate(exam.end_date);
    setSelectedClasses(exam.applicable_classes);
    setSystemType(exam.system_type || "8-4-4");
    setShowCreateModal(true);
  }

  async function handleCreateOrUpdateExam() {
    if (!examName || !term || !startDate || !endDate || selectedClasses.length === 0) {
      alert("Please fill in all required fields");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert("End date must be after start date");
      return;
    }

    try {
      const examData = {
        exam_name: examName,
        academic_year: parseInt(academicYear),
        term,
        start_date: startDate,
        end_date: endDate,
        system_type: systemType,
        applicable_classes: selectedClasses,
      };

      if (editingExam) {
        // Update existing exam (only if Draft)
        if (editingExam.status !== "Draft") {
          alert("Only draft exams can be edited");
          return;
        }

        const { error } = await supabase
          .from("exams")
          .update(examData)
          .eq("id", editingExam.id);

        if (error) throw error;
      } else {
        // Create new exam
        const { error } = await supabase.from("exams").insert([examData]);

        if (error) {
             console.error("Exam Creation Error Details:", error);
             throw error;
        }

        alert("Exam created successfully!");
      }
      
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving exam:", error);
      alert(`Error saving exam: ${error.message || error.details || 'Check console for details'}`);
    }
  }

  async function handleUpdateStatus(examId: string, newStatus: Exam["status"]) {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    // Validation
    if (exam.status === "Finalized") {
      alert("Cannot modify a finalized exam");
      return;
    }

    const confirmMessage =
      newStatus === "Finalized"
        ? "Finalizing this exam will lock all marks and transcripts permanently. Are you sure?"
        : `Change exam status to ${newStatus}?`;

    if (!confirm(confirmMessage)) return;
    
    try {
      // 1. Optimistic Update (Immediate UI Change)
      setExams(currentExams => currentExams.map(e => 
        e.id === examId ? { ...e, status: newStatus } : e
      ));

      // 2. Perform API Update
      const { error } = await supabase
        .from("exams")
        .update({
          status: newStatus,
          ...(newStatus === "Finalized" && {
            finalized_at: new Date().toISOString(),
          }),
        })
        .eq("id", examId);

      console.log('Update status result:', { error });
      
      if (error) {
        // Revert Optimistic Update on Error
        setExams(exams); 
        throw error;
      }

      // 3. Log Audit (Non-blocking)
      try {
        await supabase.rpc("log_exam_audit", {
            p_exam_id: examId,
            p_action_type: `exam_${newStatus.toLowerCase()}`,
            p_details: { previous_status: exam.status, new_status: newStatus },
        });
      } catch (auditError) {
        console.error("Audit log failed (non-blocking):", auditError);
      }

      // 4. Background Refresh
      fetchData(); 
      // alert(`Exam status updated to ${newStatus}`); // Removed to make it smoother
    } catch (error: any) {
      console.error("Error updating status:", error);
      alert(`Failed to update status: ${error.message || 'Unknown error'}`);
      fetchData(); // Sync state just in case
    }
  }

  async function handleDeleteExam(examId: string) {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return;

    if (exam.status !== "Draft") {
      alert("Only draft exams can be deleted");
      return;
    }

    if (!confirm("Are you sure you want to delete this exam?")) return;

    try {
      const { error } = await supabase.from("exams").delete().eq("id", examId);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      console.error("Error deleting exam:", error);
      alert(`Failed to delete exam: ${error.message}`);
    }
  }

  function toggleClassSelection(classId: string) {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  }

  const getStatusColor = (status: Exam["status"]) => {
    switch (status) {
      case "Draft":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "Active":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Closed":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "Finalized":
        return "bg-green-500/20 text-green-400 border-green-500/30";
    }
  };

  const getStatusIcon = (status: Exam["status"]) => {
    switch (status) {
      case "Draft":
        return <Edit2 className="w-4 h-4" />;
      case "Active":
        return <Clock className="w-4 h-4" />;
      case "Closed":
        return <AlertCircle className="w-4 h-4" />;
      case "Finalized":
        return <Lock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {editingExam ? "Edit Exam" : "Create New Exam"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Exam Name *</Label>
                <Input
                  placeholder="e.g., Term 1 Exams 2026"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="h-11 bg-muted border-border/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>System Type *</Label>
                  <Select 
                    value={systemType} 
                    onValueChange={(val: 'CBC' | '8-4-4' | 'Combined') => {
                        setSystemType(val);
                        // If Combined, select ALL classes by default or let user choose from all
                        if (val === 'Combined') {
                            setSelectedClasses([]); // Reset to let them choose, or could pre-select all
                        } else {
                            setSelectedClasses([]); 
                        }
                    }}
                  >
                    <SelectTrigger className="h-11 bg-muted border-border/50">
                      <SelectValue placeholder="Select System" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8-4-4">8-4-4 (Forms)</SelectItem>
                      <SelectItem value="CBC">CBC (Grades)</SelectItem>
                      <SelectItem value="Combined">Global Event (All Classes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Academic Year *</Label>
                  <Select value={academicYear} onValueChange={setAcademicYear}>
                    <SelectTrigger className="h-11 bg-muted border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Term *</Label>
                  <Select value={term} onValueChange={setTerm}>
                    <SelectTrigger className="h-11 bg-muted border-border/50">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11 bg-muted border-border/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 bg-muted border-border/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Applicable Classes ({systemType}) *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-muted/50 rounded-lg border border-border/50">
                  {classes
                    .filter(cls => {
                        const nameLower = cls.name.toLowerCase();
                        if (systemType === 'CBC') return nameLower.includes('grade');
                        if (systemType === '8-4-4') return nameLower.includes('form');
                        return true; // Combined shows all
                    })
                    .map((cls) => (
                    <div
                      key={cls.id}
                      onClick={() => toggleClassSelection(cls.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        selectedClasses.includes(cls.id)
                          ? "bg-primary/20 border border-primary/50"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Checkbox checked={selectedClasses.includes(cls.id)} />
                      <span className="text-sm text-foreground">
                        {cls.name} ({cls.form_level})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateOrUpdateExam} className="bg-primary">
                  {editingExam ? "Update Exam" : "Create Exam"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Exam Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage exam events
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Exam
        </Button>
      </div>

      {/* Exams List */}
      {exams.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border/50 rounded-xl">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No exams created yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click "Create Exam" to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-card border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {exam.exam_name}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-1">
                     <span>{exam.term} • {exam.academic_year}</span>
                     <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                         exam.system_type === 'CBC' ? 'border-purple-500 text-purple-600 bg-purple-50' : 
                         exam.system_type === 'Combined' ? 'border-amber-500 text-amber-600 bg-amber-50' :
                         'border-blue-500 text-blue-600 bg-blue-50'
                     }`}>
                        {exam.system_type || '8-4-4'}
                     </span>
                  </div>
                </div>
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    exam.status
                  )}`}
                >
                  {getStatusIcon(exam.status)}
                  {exam.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(exam.start_date).toLocaleDateString()} -{" "}
                    {new Date(exam.end_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4" />
                  <span>{exam.applicable_classes.length} classes</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {exam.status === "Draft" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(exam)}
                      className="flex-1"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(exam.id, "Active")}
                      className="flex-1 bg-blue-500 hover:bg-blue-600"
                    >
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteExam(exam.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}

                {exam.status === "Active" && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(exam.id, "Closed")}
                    className="w-full bg-amber-500 hover:bg-amber-600"
                  >
                    Close Exam
                  </Button>
                )}

                {exam.status === "Closed" && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus(exam.id, "Finalized")}
                    className="w-full bg-green-500 hover:bg-green-600"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    Finalize
                  </Button>
                )}

                {exam.status === "Finalized" && (
                  <div className="w-full text-center text-sm text-green-400 font-medium">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Locked
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
