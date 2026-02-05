"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Lock,
  Calendar,
  BookOpen,
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
  applicable_classes: string[];
}

interface Class {
  id: string;
  name: string;
  form_level: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
}

interface MarkEntry {
  student_id: string;
  score: number;
  remarks: string;
}

interface TeacherMarkEntryProps {
  teacherId: string;
  onClose: () => void;
}

export default function TeacherMarkEntry({ teacherId, onClose }: TeacherMarkEntryProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Map<string, MarkEntry>>(new Map());
  const [maxScore, setMaxScore] = useState(100);
  const [loading, setLoading] = useState(false);
  const [existingMarks, setExistingMarks] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    fetchClosedExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchAssignedClasses();
    }
  }, [selectedExam]);

  useEffect(() => {
    if (selectedClass) {
      fetchAssignedSubjects();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchStudents();
      fetchExistingMarks();
    }
  }, [selectedClass, selectedSubject]);

  async function fetchClosedExams() {
    const { data } = await supabase
      .from("exams")
      .select("*")
      .eq("status", "Closed")
      .order("created_at", { ascending: false });

    if (data) setExams(data);
  }

  async function fetchAssignedClasses() {
    if (!selectedExam) return;

    const { data } = await supabase
      .from("teacher_classes")
      .select(`
        class_id,
        classes!inner(id, name, form_level)
      `)
      .eq("teacher_id", teacherId);

    if (data) {
      const classes = data
        .map((tc: any) => tc.classes)
        .filter((c: Class) =>
          selectedExam.applicable_classes.includes(c.id)
        );
      setAssignedClasses(classes);
    }
  }

  async function fetchAssignedSubjects() {
    if (!selectedClass) return;

    const { data } = await supabase
      .from("teacher_classes")
      .select("subjects")
      .eq("teacher_id", teacherId)
      .eq("class_id", selectedClass)
      .single();

    if (data && data.subjects) {
      const { data: subjectsData } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", data.subjects);

      if (subjectsData) setAssignedSubjects(subjectsData);
    }
  }

  async function fetchStudents() {
    if (!selectedClass) return;

    const className = assignedClasses.find((c) => c.id === selectedClass)?.name;
    if (!className) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, admission_number")
      .eq("form_class", className)
      .eq("role", "student")
      .order("full_name", { ascending: true });

    if (data) {
      setStudents(data);
      // Initialize marks map
      const initialMarks = new Map<string, MarkEntry>();
      data.forEach((student) => {
        initialMarks.set(student.id, {
          student_id: student.id,
          score: 0,
          remarks: "",
        });
      });
      setMarks(initialMarks);
    }
  }

  async function fetchExistingMarks() {
    if (!selectedExam || !selectedClass || !selectedSubject) return;

    const { data } = await supabase
      .from("marks")
      .select("*")
      .eq("exam_id", selectedExam.id)
      .eq("class_id", selectedClass)
      .eq("subject_id", selectedSubject);

    if (data) {
      const existingMap = new Map();
      const marksMap = new Map(marks);

      data.forEach((mark) => {
        existingMap.set(mark.student_id, mark);
        marksMap.set(mark.student_id, {
          student_id: mark.student_id,
          score: mark.score,
          remarks: mark.remarks || "",
        });
      });

      setExistingMarks(existingMap);
      setMarks(marksMap);
    }
  }

  function updateMark(studentId: string, field: "score" | "remarks", value: any) {
    const currentMark = marks.get(studentId) || {
      student_id: studentId,
      score: 0,
      remarks: "",
    };

    setMarks(
      new Map(
        marks.set(studentId, {
          ...currentMark,
          [field]: field === "score" ? parseFloat(value) || 0 : value,
        })
      )
    );
  }

  async function handleSubmitMarks() {
    if (!selectedExam || !selectedClass || !selectedSubject) {
      alert("Please select exam, class, and subject");
      return;
    }

    // Validate all scores
    const invalidScores = Array.from(marks.values()).filter(
      (m) => m.score < 0 || m.score > maxScore
    );

    if (invalidScores.length > 0) {
      alert(`Invalid scores detected. All scores must be between 0 and ${maxScore}`);
      return;
    }

    if (
      !confirm(
        `Submit marks for ${students.length} students? This will ${
          existingMarks.size > 0 ? "update existing" : "create new"
        } marks.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const marksToSubmit = Array.from(marks.values()).map((mark) => ({
        exam_id: selectedExam.id,
        student_id: mark.student_id,
        class_id: selectedClass,
        subject_id: selectedSubject,
        teacher_id: teacherId,
        score: mark.score,
        max_score: maxScore,
        remarks: mark.remarks,
      }));

      // Upsert marks (insert or update)
      const { error } = await supabase.from("marks").upsert(marksToSubmit, {
        onConflict: "exam_id,student_id,subject_id",
      });

      if (error) throw error;

      // Log audit event
      await supabase.rpc("log_exam_audit", {
        p_exam_id: selectedExam.id,
        p_action_type: existingMarks.size > 0 ? "marks_updated" : "marks_submitted",
        p_details: {
          class_id: selectedClass,
          subject_id: selectedSubject,
          student_count: students.length,
        },
      });

      alert("Marks submitted successfully!");
      onClose();
    } catch (error: any) {
      console.error("Error submitting marks:", error);
      alert(`Failed to submit marks: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Exam Context (Locked) */}
      {selectedExam && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Exam Context (Locked)</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Exam</p>
              <p className="font-medium text-foreground">{selectedExam.exam_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Term</p>
              <p className="font-medium text-foreground">{selectedExam.term}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Year</p>
              <p className="font-medium text-foreground">{selectedExam.academic_year}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Period</p>
              <p className="font-medium text-foreground">
                {new Date(selectedExam.start_date).toLocaleDateString()} -{" "}
                {new Date(selectedExam.end_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selection Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Select Exam *</Label>
          <Select
            value={selectedExam?.id || ""}
            onValueChange={(value) => {
              const exam = exams.find((e) => e.id === value);
              setSelectedExam(exam || null);
              setSelectedClass("");
              setSelectedSubject("");
            }}
          >
            <SelectTrigger className="h-11 bg-muted border-border/50">
              <SelectValue placeholder="Choose exam" />
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
          <Label>Select Class *</Label>
          <Select
            value={selectedClass}
            onValueChange={setSelectedClass}
            disabled={!selectedExam}
          >
            <SelectTrigger className="h-11 bg-muted border-border/50">
              <SelectValue placeholder="Choose class" />
            </SelectTrigger>
            <SelectContent>
              {assignedClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.form_level})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Select Subject *</Label>
          <Select
            value={selectedSubject}
            onValueChange={setSelectedSubject}
            disabled={!selectedClass}
          >
            <SelectTrigger className="h-11 bg-muted border-border/50">
              <SelectValue placeholder="Choose subject" />
            </SelectTrigger>
            <SelectContent>
              {assignedSubjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Max Score Input */}
      {selectedSubject && (
        <div className="space-y-2">
          <Label>Maximum Score</Label>
          <Input
            type="number"
            value={maxScore}
            onChange={(e) => setMaxScore(parseFloat(e.target.value) || 100)}
            className="h-11 bg-muted border-border/50 max-w-xs"
            min={1}
            max={1000}
          />
        </div>
      )}

      {/* Students Table */}
      {students.length > 0 && (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                Student Marks ({students.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Max Score: {maxScore} points
              </p>
            </div>
            {existingMarks.size > 0 && (
              <span className="flex items-center gap-2 text-sm text-amber-400">
                <AlertCircle className="w-4 h-4" />
                Editing existing marks
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Admission No.
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Student Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Score (/{maxScore})
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Remarks (Optional)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {students.map((student, index) => {
                  const mark = marks.get(student.id);
                  return (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">
                        {student.admission_number}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {student.full_name}
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={mark?.score || 0}
                          onChange={(e) =>
                            updateMark(student.id, "score", e.target.value)
                          }
                          className="h-9 w-24 bg-muted border-border/50"
                          min={0}
                          max={maxScore}
                          step={0.5}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={mark?.remarks || ""}
                          onChange={(e) =>
                            updateMark(student.id, "remarks", e.target.value)
                          }
                          placeholder="e.g., Excellent work"
                          className="h-9 bg-muted border-border/50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/30">
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmitMarks}
              disabled={loading || students.length === 0}
              className="bg-primary"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Submitting..." : "Submit Marks"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedExam && selectedClass && selectedSubject && students.length === 0 && (
        <div className="text-center py-12 bg-card border border-border/50 rounded-xl">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No students found in this class</p>
        </div>
      )}
    </div>
  );
}
