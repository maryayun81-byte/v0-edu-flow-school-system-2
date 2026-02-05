"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  FileText,
  Download,
  Send,
  AlertCircle,
  CheckCircle,
  Lock,
  Eye,
  X,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  status: string;
}

interface Class {
  id: string;
  name: string;
  form_level: string;
}

interface TranscriptReadiness {
  class_id: string;
  class_name: string;
  total_students: number;
  students_with_complete_marks: number;
  completion_percentage: number;
  missing_marks: any[];
}

interface Transcript {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  total_score: number;
  average_score: number;
  overall_grade: string;
  class_position: number;
  admin_remarks: string;
  status: string;
  items: TranscriptItem[];
}

interface TranscriptItem {
  subject_name: string;
  score: number;
  max_score: number;
  grade: string;
  teacher_remarks: string;
}

export default function AdminTranscriptManager() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [readiness, setReadiness] = useState<TranscriptReadiness | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [previewTranscript, setPreviewTranscript] = useState<Transcript | null>(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchExams();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedExam && selectedClass) {
      checkReadiness();
    }
  }, [selectedExam, selectedClass]);

  async function fetchExams() {
    const { data } = await supabase
      .from("exams")
      .select("*")
      .in("status", ["Closed", "Finalized"])
      .order("created_at", { ascending: false });

    if (data) setExams(data);
  }

  async function fetchClasses() {
    const { data } = await supabase
      .from("classes")
      .select("id, name, form_level")
      .order("form_level", { ascending: true });

    if (data) setClasses(data);
  }

  async function checkReadiness() {
    setLoading(true);
    try {
      // Get all students in the class
      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name, admission_number")
        .eq("form_class", classes.find((c) => c.id === selectedClass)?.name);

      if (!students) return;

      // Get all subjects taught in this class
      const { data: teacherClasses } = await supabase
        .from("teacher_classes")
        .select("subjects")
        .eq("class_id", selectedClass);

      const allSubjects = new Set<string>();
      teacherClasses?.forEach((tc) => {
        tc.subjects.forEach((s: string) => allSubjects.add(s));
      });

      // Check marks completeness for each student
      let completeCount = 0;
      const missingMarks: any[] = [];

      for (const student of students) {
        const { data: marks } = await supabase
          .from("marks")
          .select("subject_id")
          .eq("exam_id", selectedExam)
          .eq("student_id", student.id);

        const markedSubjects = new Set(marks?.map((m) => m.subject_id) || []);
        const isComplete = allSubjects.size === markedSubjects.size;

        if (isComplete) {
          completeCount++;
        } else {
          const missing = Array.from(allSubjects).filter(
            (s) => !markedSubjects.has(s)
          );
          missingMarks.push({
            student_name: student.full_name,
            missing_subjects: missing,
          });
        }
      }

      setReadiness({
        class_id: selectedClass,
        class_name: classes.find((c) => c.id === selectedClass)?.name || "",
        total_students: students.length,
        students_with_complete_marks: completeCount,
        completion_percentage: Math.round((completeCount / students.length) * 100),
        missing_marks: missingMarks,
      });
    } catch (error) {
      console.error("Error checking readiness:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTranscripts() {
    if (!selectedExam || !selectedClass) return;

    if (readiness && readiness.completion_percentage < 100) {
      if (
        !confirm(
          "Not all students have complete marks. Generate transcripts anyway?"
        )
      ) {
        return;
      }
    }

    setLoading(true);
    try {
      // Get all students in class
      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name, admission_number")
        .eq("form_class", classes.find((c) => c.id === selectedClass)?.name);

      if (!students) return;

      const generatedTranscripts: Transcript[] = [];

      for (const student of students) {
        // Get all marks for this student in this exam
        const { data: marks } = await supabase
          .from("marks")
          .select(`
            score,
            max_score,
            grade,
            remarks,
            subjects!inner(name)
          `)
          .eq("exam_id", selectedExam)
          .eq("student_id", student.id);

        if (!marks || marks.length === 0) continue;

        // Calculate totals
        const totalScore = marks.reduce((sum, m) => sum + m.score, 0);
        const totalMaxScore = marks.reduce((sum, m) => sum + m.max_score, 0);
        const averageScore = (totalScore / totalMaxScore) * 100;

        // Create transcript items
        const items: TranscriptItem[] = marks.map((m: any) => ({
          subject_name: m.subjects.name,
          score: m.score,
          max_score: m.max_score,
          grade: m.grade,
          teacher_remarks: m.remarks || "",
        }));

        generatedTranscripts.push({
          id: "", // Will be set after insert
          student_id: student.id,
          student_name: student.full_name,
          admission_number: student.admission_number,
          total_score: totalScore,
          average_score: averageScore,
          overall_grade: calculateGrade(averageScore),
          class_position: 0, // Will calculate after all transcripts
          admin_remarks: "",
          status: "Draft",
          items,
        });
      }

      // Sort by average score to calculate positions
      generatedTranscripts.sort((a, b) => b.average_score - a.average_score);
      generatedTranscripts.forEach((t, index) => {
        t.class_position = index + 1;
      });

      setTranscripts(generatedTranscripts);
    } catch (error) {
      console.error("Error generating transcripts:", error);
      alert("Failed to generate transcripts");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishTranscript(transcript: Transcript) {
    if (!confirm("Publishing will lock this transcript permanently. Continue?")) {
      return;
    }

    setLoading(true);
    try {
      // Insert transcript
      const { data: insertedTranscript, error: transcriptError } = await supabase
        .from("transcripts")
        .insert([
          {
            exam_id: selectedExam,
            student_id: transcript.student_id,
            class_id: selectedClass,
            total_score: transcript.total_score,
            average_score: transcript.average_score,
            overall_grade: transcript.overall_grade,
            class_position: transcript.class_position,
            admin_remarks: adminRemarks,
            status: "Published",
            published_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (transcriptError) throw transcriptError;

      // Insert transcript items
      const items = transcript.items.map((item) => ({
        transcript_id: insertedTranscript.id,
        subject_id: "", // You'll need to look this up
        subject_name: item.subject_name,
        score: item.score,
        max_score: item.max_score,
        grade: item.grade,
        teacher_remarks: item.teacher_remarks,
      }));

      const { error: itemsError } = await supabase
        .from("transcript_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Send notification to student
      await supabase.from("notifications").insert([
        {
          type: "transcript_published",
          title: "Transcript Available",
          message: `Your ${exams.find((e) => e.id === selectedExam)?.exam_name} transcript is now available`,
          target_role: "student",
          target_user_id: transcript.student_id,
        },
      ]);

      alert("Transcript published successfully!");
      setPreviewTranscript(null);
      setAdminRemarks("");
    } catch (error: any) {
      console.error("Error publishing transcript:", error);
      alert(`Failed to publish transcript: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function calculateGrade(percentage: number): string {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "A-";
    if (percentage >= 75) return "B+";
    if (percentage >= 70) return "B";
    if (percentage >= 65) return "B-";
    if (percentage >= 60) return "C+";
    if (percentage >= 55) return "C";
    if (percentage >= 50) return "C-";
    if (percentage >= 45) return "D+";
    if (percentage >= 40) return "D";
    if (percentage >= 35) return "D-";
    return "E";
  }

  return (
    <div className="space-y-6">
      {/* Preview Modal */}
      {previewTranscript && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-2xl w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Transcript Document */}
            <div className="p-8 bg-white text-black">
              {/* Header */}
              <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Official Academic Transcript
                </h1>
                <p className="text-lg text-gray-600">
                  {exams.find((e) => e.id === selectedExam)?.exam_name}
                </p>
                <p className="text-sm text-gray-500">
                  {exams.find((e) => e.id === selectedExam)?.term} •{" "}
                  {exams.find((e) => e.id === selectedExam)?.academic_year}
                </p>
              </div>

              {/* Student Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Student Name</p>
                  <p className="font-semibold text-gray-900">
                    {previewTranscript.student_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Admission Number</p>
                  <p className="font-semibold text-gray-900">
                    {previewTranscript.admission_number}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Class</p>
                  <p className="font-semibold text-gray-900">
                    {classes.find((c) => c.id === selectedClass)?.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Exam Period</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(
                      exams.find((e) => e.id === selectedExam)?.start_date || ""
                    ).toLocaleDateString()}{" "}
                    -{" "}
                    {new Date(
                      exams.find((e) => e.id === selectedExam)?.end_date || ""
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Results Table */}
              <table className="w-full mb-6 border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 px-4 py-2 text-left">
                      Subject
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center">
                      Score
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center">
                      Max
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center">
                      Grade
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewTranscript.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2">
                        {item.subject_name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">
                        {item.score}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {item.max_score}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-bold">
                        {item.grade}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {item.teacher_remarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 mb-6 bg-gray-100 p-4 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {previewTranscript.total_score}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Average</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {previewTranscript.average_score.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Overall Grade</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {previewTranscript.overall_grade}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Position</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {previewTranscript.class_position}
                  </p>
                </div>
              </div>

              {/* Admin Remarks */}
              <div className="mb-6">
                <Label className="text-gray-900 mb-2 block">
                  Admin Remarks
                </Label>
                <textarea
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="Enter academic summary and recommendations..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between p-6 border-t border-border/50 bg-card">
              <Button
                variant="ghost"
                onClick={() => {
                  setPreviewTranscript(null);
                  setAdminRemarks("");
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button
                  onClick={() => handlePublishTranscript(previewTranscript)}
                  disabled={loading}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Publish Transcript
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Transcript Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate and publish student transcripts
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Select Exam</Label>
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger className="h-11 bg-muted border-border/50">
              <SelectValue placeholder="Choose an exam" />
            </SelectTrigger>
            <SelectContent>
              {exams.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.exam_name} ({exam.term} {exam.academic_year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Select Class</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="h-11 bg-muted border-border/50">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.form_level})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Readiness Status */}
      {readiness && (
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              Transcript Readiness
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                readiness.completion_percentage === 100
                  ? "bg-green-500/20 text-green-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {readiness.completion_percentage}% Complete
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold text-foreground">
                {readiness.total_students}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Complete Marks</p>
              <p className="text-2xl font-bold text-foreground">
                {readiness.students_with_complete_marks}
              </p>
            </div>
          </div>

          {readiness.missing_marks.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <p className="font-medium text-amber-400">Missing Marks</p>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {readiness.missing_marks.slice(0, 5).map((item, index) => (
                  <p key={index}>
                    {item.student_name} - {item.missing_subjects.length}{" "}
                    subject(s)
                  </p>
                ))}
                {readiness.missing_marks.length > 5 && (
                  <p className="text-amber-400">
                    +{readiness.missing_marks.length - 5} more...
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerateTranscripts}
            disabled={loading || !selectedExam || !selectedClass}
            className="w-full mt-4 bg-primary"
          >
            <FileText className="w-4 h-4 mr-2" />
            Generate Transcripts
          </Button>
        </div>
      )}

      {/* Generated Transcripts */}
      {transcripts.length > 0 && (
        <div className="bg-card border border-border/50 rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">
            Generated Transcripts ({transcripts.length})
          </h3>
          <div className="space-y-2">
            {transcripts.map((transcript) => (
              <div
                key={transcript.student_id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {transcript.student_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Avg: {transcript.average_score.toFixed(1)}% • Grade:{" "}
                    {transcript.overall_grade} • Position:{" "}
                    {transcript.class_position}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPreviewTranscript(transcript);
                    setAdminRemarks("");
                  }}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview & Publish
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
