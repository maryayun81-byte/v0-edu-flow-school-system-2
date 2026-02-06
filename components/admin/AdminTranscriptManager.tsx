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
  RefreshCw,
  Search,
  Filter
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
  applicable_classes: string[];
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
  id?: string; // Optional for draft/new
  student_id: string;
  student_name: string;
  admission_number: string;
  total_score: number;
  average_score: number;
  overall_grade: string;
  class_position: number;
  admin_remarks: string;
  status: string; // 'Draft' | 'Published'
  published_at?: string;
  items: TranscriptItem[];
}

interface TranscriptItem {
  subject_id: string;
  subject_name: string;
  score: number;
  max_score: number;
  grade: string;
  teacher_remarks: string;
}

interface SchoolSettings {
  school_name: string;
  logo_url: string | null;
  stamp_url: string | null;

  signature_url: string | null;
  auto_attach_stamp: boolean;
  auto_attach_signature: boolean;
  transcript_theme: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
}

interface GradingScale {
  grade_label: string;
  min_percentage: number;
  max_percentage: number;
  grade_points: number;
  remarks: string;
}

interface Signature {
  role: string;
  signature_url: string;
}

export default function AdminTranscriptManager() {
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [readiness, setReadiness] = useState<TranscriptReadiness | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [previewTranscript, setPreviewTranscript] = useState<Transcript | null>(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  
  // Grading State
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([]);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);

  const itemsPerPage = 20;

  useEffect(() => {
    fetchClasses();
    fetchExams(); // Fetch all exams initially, we filter in UI
    fetchSettings();
    fetchGradingSystem();
    fetchActiveSignature();
  }, []);

  async function fetchGradingSystem() {
      // 1. Get active system
      const { data: system } = await supabase.from("grading_systems").select("id").eq("is_active", true).single();
      if (!system) return;

      // 2. Get scales
      const { data: scales } = await supabase
        .from("grading_scales")
        .select("*")
        .eq("grading_system_id", system.id)
        .order("min_percentage", { ascending: false });
      
      if (scales) setGradingScales(scales);
  }

  async function fetchActiveSignature() {
      // Try to get Principal signature from new table
      const { data } = await supabase
        .from("signatures")
        .select("signature_url")
        .eq("role", "Principal")
        .eq("is_active", true)
        .single();
      
      if (data) setActiveSignature(data.signature_url);
  }

  async function fetchExams() {
    const { data } = await supabase
      .from("exams")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setExams(data);
  }

  async function fetchClasses() {
    const { data } = await supabase
      .from("classes")
      .select("*")
      .order("form_level", { ascending: true });
    if (data) setClasses(data);
  }
  
  // When Class or Exam changes, try to fetch EXISTING transcripts first
  useEffect(() => {
    if (selectedExam && selectedClass) {
        setTranscripts([]); // Clear previous
        checkReadiness();
        fetchExistingTranscripts();
    } else {
      setReadiness(null);
      setTranscripts([]);
    }
  }, [selectedExam, selectedClass]);

  async function fetchExistingTranscripts() {
      if (!selectedExam || !selectedClass) return;
      
      setLoading(true);
      try {
          // Use the RPC if available, otherwise manual join
          // We created get_class_transcripts in the SQL script
          const { data, error } = await supabase.rpc('get_class_transcripts', {
              p_exam_id: selectedExam,
              p_class_id: selectedClass
          });

          if (error) {
             console.error("Error fetching existing transcripts:", error);
             // Fallback or just ignore if function doesn't exist yet
             return;
          }

          if (data && data.length > 0) {
              setTranscripts(data);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  }

  async function checkReadiness() {
     try {
        // setLoading(true); // Don't block UI fully, let it load in background
        const { count: totalStudents } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "student")
            .eq("form_class", classes.find(c => c.id === selectedClass)?.name || "");
        
        if (totalStudents === null) return;
        
        const { data: missingMarks } = await supabase.rpc('get_missing_marks', { 
            p_exam_id: selectedExam 
        });

        const classMissingRows = missingMarks?.filter((m: any) => m.class_id === selectedClass) || [];
        const isComplete = classMissingRows.length === 0;

        const missingDetails = classMissingRows.map((row: any) => ({
             student_name: `${row.missing_count} Students`, 
             missing_subjects: [row.subject_name],
             responsible_teacher_id: row.responsible_teacher_id,
             subject_id: row.subject_id
        }));

        setReadiness({
            class_id: selectedClass,
            class_name: classes.find(c => c.id === selectedClass)?.name || "",
            total_students: totalStudents || 0,
            students_with_complete_marks: isComplete ? totalStudents : -1,
            completion_percentage: isComplete ? 100 : Math.max(0, 100 - (classMissingRows.length * 10)),
            missing_marks: missingDetails
        });

    } catch (e) {
        console.error(e);
    }
  }

  async function handleGenerateTranscripts(regenerate: boolean = false) {
    if (!selectedExam || !selectedClass) return;

    if (readiness && readiness.completion_percentage < 100 && !confirm("Marks are incomplete. Are you sure you want to generate transcripts? Incomplete subjects may be missing.")) {
      return;
    }
    
    // If transcripts already exist and we are NOT regenerating, warn/stop
    const existingCount = transcripts.length;
    if (existingCount > 0 && !regenerate) {
        if (!confirm(`Found ${existingCount} existing transcripts. Do you want to RE-GENERATE them? This may overwrite unsaved drafts.`)) {
            return;
        }
    }

    setLoading(true);
    try {
      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name, admission_number")
        .eq("form_class", classes.find((c) => c.id === selectedClass)?.name);

      if (!students) return;

      const generatedTranscripts: Transcript[] = [];

      for (const student of students) {
        // preserve ID/Status if we already have it
        const existing = transcripts.find(t => t.student_id === student.id);
        
        // Get all marks for this student in this exam
        const { data: marks } = await supabase
          .from("marks")
          .select(`
            subject_id,
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
        const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

        const items: TranscriptItem[] = marks.map((m: any) => ({
          subject_id: m.subject_id,
          subject_name: m.subjects.name,
          score: m.score,
          max_score: m.max_score,
          grade: m.grade,
          teacher_remarks: m.remarks || "",
        }));

        generatedTranscripts.push({
          id: existing?.id, // Keep existing ID if any
          student_id: student.id,
          student_name: student.full_name,
          admission_number: student.admission_number,
          total_score: totalScore,
          average_score: averageScore,
          overall_grade: calculateGrade(averageScore),
          class_position: 0, 
          admin_remarks: existing?.admin_remarks || "",
          status: existing?.status || "Draft", // Keep status
          published_at: existing?.published_at,
          items,
        });
      }

      // Sort and Rank
      generatedTranscripts.sort((a, b) => b.average_score - a.average_score);
      generatedTranscripts.forEach((t, index) => {
        t.class_position = index + 1;
      });

      setTranscripts(generatedTranscripts);
      
      // Autosave drafts to persistence? Maybe too heavy. 
      // For now, these are in-memory until "Publish". 
      // But user wanted persistence. 
      // Ideally "Generate" should UPSERT to DB immediately as Drafts.
      // Let's do that for better UX.
      await saveDraftsBatch(generatedTranscripts);
      
      // Reload to get precise state
      await fetchExistingTranscripts();

    } catch (error) {
      console.error("Error generating transcripts:", error);
      alert("Failed to generate transcripts");
    } finally {
      setLoading(false);
    }
  }
  
  async function saveDraftsBatch(list: Transcript[]) {
      try {
        // 1. Prepare transcripts payload
        const transcriptPayloads = list.map(t => ({
            exam_id: selectedExam,
            student_id: t.student_id,
            class_id: selectedClass,
            total_score: t.total_score,
            average_score: t.average_score,
            overall_grade: t.overall_grade,
            class_position: t.class_position,
            admin_remarks: t.admin_remarks,
            status: t.status // preserve
        }));

        // 2. Upsert Transcripts and get IDs
        const { data: savedTranscripts, error } = await supabase
            .from("transcripts")
            .upsert(transcriptPayloads, { onConflict: 'exam_id, student_id' })
            .select();
        
        if (error || !savedTranscripts) {
            console.error("Autosave headers error", error);
            alert("Failed to save drafts. Please try again.");
            return;
        }

        // 3. Prepare Items Payload
        let allItems: any[] = [];
        
        for (const savedT of savedTranscripts) {
            const original = list.find(t => t.student_id === savedT.student_id);
            if (original && original.items) {
                const itemsWithId = original.items.map(item => ({
                    transcript_id: savedT.id,
                    subject_id: item.subject_id,
                    subject_name: item.subject_name,
                    score: item.score,
                    max_score: item.max_score,
                    grade: item.grade,
                    teacher_remarks: item.teacher_remarks
                }));
                allItems = [...allItems, ...itemsWithId];
            }
        }

        // 4. Delete old items for these transcripts (to cleanup before insert)
        const transcriptIds = savedTranscripts.map(t => t.id);
        if (transcriptIds.length > 0) {
            const { error: deleteError } = await supabase
                .from("transcript_items")
                .delete()
                .in("transcript_id", transcriptIds);
            
            if (deleteError) {
                 console.error("Error clearing old items:", deleteError);
            }

            // 5. Insert new items
            if (allItems.length > 0) {
                const { error: itemsError } = await supabase.from("transcript_items").insert(allItems);
                if (itemsError) {
                    console.error("Error saving items:", itemsError);
                    alert("Drafts saved, but failed to save subjects details.");
                }
            }
        }
      } catch (e) {
         console.error("Critical autosave error:", e);
      }
  }

  async function handlePublishTranscript(transcript: Transcript) {
    if (!transcript.id) {
         // Should have ID if we autosaved, but generic check
         // fetch ID? or just proceed.
    }
    
    if (transcript.status === 'Published' && !confirm("This transcript is already published. Publish again (update)?")) {
        return;
    }

    setLoading(true);
    try {
      // Upsert Transcript
      const { data: insertedTranscript, error: transcriptError } = await supabase
        .from("transcripts")
        .upsert([
          {
            exam_id: selectedExam,
            student_id: transcript.student_id,
            class_id: selectedClass,
            total_score: transcript.total_score,
            average_score: transcript.average_score,
            overall_grade: transcript.overall_grade,
            class_position: transcript.class_position,
            admin_remarks: adminRemarks || transcript.admin_remarks, // Use current input or existing
            status: "Published",
            published_at: new Date().toISOString(),
          },
        ], { onConflict: 'exam_id, student_id' })
        .select()
        .single();

      if (transcriptError) throw transcriptError;

      // Update items
      const { error: deleteError } = await supabase
        .from("transcript_items")
        .delete()
        .eq("transcript_id", insertedTranscript.id);
        
      if (deleteError) throw deleteError;

      const items = transcript.items.map((item) => ({
        transcript_id: insertedTranscript.id,
        subject_id: item.subject_id,
        subject_name: item.subject_name,
        score: item.score,
        max_score: item.max_score,
        grade: item.grade,
        teacher_remarks: item.teacher_remarks,
      }));

      const { error: itemsError } = await supabase.from("transcript_items").insert(items);
      if (itemsError) throw itemsError;

      // Notification
      await supabase.from("notifications").insert([
        {
          type: "transcript_published",
          title: "Transcript Available",
          message: `Your ${exams.find((e) => e.id === selectedExam)?.exam_name} transcript is now available.`,
          target_role: "student",
          target_user_id: transcript.student_id,
        },
      ]);

      alert("Transcript published successfully!");
      setPreviewTranscript(null);
      setAdminRemarks("");
      fetchExistingTranscripts(); // Refresh UI
    } catch (error: any) {
      console.error("Error publishing transcript:", error);
      alert(`Failed to publish transcript: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function calculateGrade(percentage: number): string {
    if (gradingScales.length > 0) {
        const match = gradingScales.find(s => percentage >= s.min_percentage && percentage <= s.max_percentage);
        return match ? match.grade_label : "E";
    }
    
    // Fallback Legacy
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

  async function fetchSettings() {
    const { data } = await supabase.from("school_settings").select("*").single();
    if (data) setSettings(data);
  }

  useEffect(() => {
    if (previewTranscript) {
      fetchSettings();
      // Pre-fill remarks if existing
      setAdminRemarks(previewTranscript.admin_remarks || "");
    }
  }, [previewTranscript]);

  async function handleNotifyTeacher(teacherId: string, subjectName: string) {
      // ... existing code ...
      if (!teacherId) return;
      try {
          const { error } = await supabase.from("notifications").insert({
              target_user_id: teacherId,
              target_role: 'teacher',
              type: 'system_alert',
              title: 'Missing Marks Alert',
              message: `You have missing marks for ${subjectName} in ${readiness?.class_name || 'your class'}. Please complete them immediately.`,
              is_read: false
          });

          if (error) throw error;
          alert("Teacher notified successfully.");
      } catch (e: any) {
          console.error(e);
          alert("Failed to notify teacher: " + e.message);
      }
  }

  function getThemeClasses(theme: string = "Modern") {
     const base = "min-h-[900px] relative p-12 transition-all duration-300 print:min-h-screen";
    switch(theme) {
      case "Classic": return `${base} font-serif bg-white text-black border-[3px] border-double border-black`;
      case "Elegant": return `${base} font-serif bg-[#FFFAF0] text-slate-900 border-[6px] border-double border-amber-300 shadow-inner`;
      case "Professional": return `${base} font-sans bg-white text-slate-800 border bg-[url('/bg-grid.png')]`;
      case "Minimalist": return `${base} font-light bg-white text-neutral-600 tracking-wide`;
      case "Academic": return `${base} font-serif bg-white text-black border-[12px] border-double border-[#800000]/20`;
      case "Tech": return `${base} font-mono bg-slate-50 text-slate-900 border-l-8 border-slate-900`;
      case "Creative": return `${base} font-sans bg-white text-purple-900 rounded-3xl border-4 border-dashed border-purple-200`;
      default: return `${base} font-sans bg-white text-black`; // Modern
    }
  }
  
  // Filter transcripts for view
  const filteredTranscripts = transcripts.filter(t => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'published') return t.status === 'Published';
      if (statusFilter === 'draft') return t.status === 'Draft';
      return true;
  });

  return (
    <div className="space-y-6">
      {/* Preview Modal */}
      {previewTranscript && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-2xl w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
             <div className="p-4 border-b border-border/50 flex items-center justify-between sticky top-0 bg-card z-50">
                <h3 className="font-bold text-lg">Transcript Preview: {previewTranscript.student_name}</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewTranscript(null)}>
                    <X className="w-5 h-5" />
                </Button>
             </div>
             
             {/* Printable Area */}
            <div className={`mx-auto ${getThemeClasses(settings?.transcript_theme)}`} style={{ maxWidth: "210mm" }}>
               
               {/* WATERMARK */}
              {settings?.logo_url && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                    <img src={settings.logo_url} className="w-[500px] h-[500px] object-contain grayscale" />
                 </div>
              )}

              {/* BRANDING: Header */}
              <div className="flex items-center justify-between mb-12 border-b-[3px] border-current pb-6 relative z-10">
                 {settings?.logo_url && (
                   <img src={settings.logo_url} alt="School Logo" className="h-32 w-32 object-contain" />
                 )}
                 <div className="flex-1 text-center px-8">
                    <h1 className="text-4xl font-black uppercase tracking-widest mb-2 font-serif">
                       {settings?.school_name || "Official Transcript"}
                    </h1>
                    <div className="text-xs uppercase tracking-[0.3em] opacity-70 mb-4">Excellence • Integrity • Knowledge</div>
                    <h2 className="text-2xl font-bold bg-black/5 inline-block px-8 py-1 rounded-sm uppercase tracking-wide">
                      Academic Transcript
                    </h2>
                 </div>
                 <div className="text-right text-xs opacity-70 space-y-1 w-32">
                    <p className="font-bold">{new Date().getFullYear()}</p>
                    <p>Generated on</p>
                    <p>{new Date().toLocaleDateString()}</p>
                 </div>
              </div>

               {/* Student & Exam Info Grid */}
              <div className="bg-current/5 rounded-lg p-6 mb-10 relative z-10">
                <div className="grid grid-cols-2 gap-x-12 gap-y-6 text-sm">
                   <div>
                      <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Student Name</p>
                      <p className="font-bold text-lg border-b border-current/10 pb-1">{previewTranscript.student_name}</p>
                   </div>
                   <div>
                       <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Exam Session</p>
                       <p className="font-bold text-lg border-b border-current/10 pb-1">
                          {exams.find((e) => e.id === selectedExam)?.exam_name}
                       </p>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Admission No.</p>
                         <p className="font-semibold">{previewTranscript.admission_number}</p>
                      </div>
                      <div>
                         <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Class</p>
                         <p className="font-semibold">{classes.find((c) => c.id === selectedClass)?.name}</p>
                      </div>
                   </div>
                      
                    {/* NEW: School Address/Contact Info if available */}
                   {(settings?.motto || settings?.email) && (
                       <div className="col-span-2 mt-2 text-xs opacity-70 border-t border-current/10 pt-2 flex justify-between">
                            <span>{settings?.motto}</span>
                            <span>{settings?.email} | {settings?.phone}</span>
                       </div>
                   )}
                   <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Term</p>
                          <p className="font-semibold">{exams.find((e) => e.id === selectedExam)?.term}</p>
                       </div>
                       <div>
                           <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Year</p>
                           <p className="font-semibold">{exams.find((e) => e.id === selectedExam)?.academic_year}</p>
                       </div>
                   </div>
                </div>
              </div>

               {/* Results Table */}
              <div className="relative z-10 mb-12">
                 <table className="w-full border-collapse text-sm">
                   <thead>
                     <tr className="border-b-[3px] border-current text-left">
                       <th className="py-2.5 font-bold uppercase tracking-wider text-xs w-1/2">Subject</th>
                       <th className="py-2.5 text-center font-bold uppercase tracking-wider text-xs">Score (%)</th>
                       <th className="py-2.5 text-center font-bold uppercase tracking-wider text-xs">Grade</th>
                       <th className="py-2.5 text-right font-bold uppercase tracking-wider text-xs pl-4">Remarks</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-current/10">
                     {(previewTranscript.items || []).map((item, index) => (
                       <tr key={index} className={index % 2 === 0 ? "bg-current/[0.02]" : "bg-transparent"}>
                         <td className="py-3 px-2 font-medium">{item.subject_name}</td>
                         <td className="py-3 text-center font-mono">{item.score}</td>
                         <td className="py-3 text-center font-bold">{item.grade}</td>
                         <td className="py-3 text-right pr-2 italic opacity-80">{item.teacher_remarks}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
              
              {/* Summary Metrics */}
              <div className="flex justify-end mb-16 relative z-10">
                 <div className="flex gap-8 border-t border-b border-current py-4 px-8">
                     <div className="text-center">
                        <p className="text-xs uppercase tracking-widest opacity-60">Total Score</p>
                        <p className="text-3xl font-black">{previewTranscript.total_score}</p>
                     </div>
                     <div className="text-center px-8 border-x border-current/20">
                        <p className="text-xs uppercase tracking-widest opacity-60">Average</p>
                        <p className="text-3xl font-black">{previewTranscript.average_score.toFixed(1)}%</p>
                     </div>
                     <div className="text-center">
                        <p className="text-xs uppercase tracking-widest opacity-60">Overall Grade</p>
                        <p className="text-3xl font-black text-primary/80">{previewTranscript.overall_grade}</p>
                     </div>
                 </div>
              </div>
              
              {/* Remarks */}
              <div className="grid grid-cols-5 gap-12 mt-auto relative z-10 hidden print:grid">
                 {/* Print-only footer version */}
                 <div className="col-span-3">
                     <p className="uppercase text-xs tracking-widest opacity-60 mb-2 font-bold">Principal's Remarks</p>
                     <p className="uppercase text-xs tracking-widest opacity-60 mb-2 font-bold">Director's Remarks</p>
                     <p className="border-b border-current/20 pb-1 italic">{adminRemarks || previewTranscript.admin_remarks}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-5 gap-12 mt-auto relative z-10 print:hidden">
                 <div className="col-span-3">
                    <Label className="uppercase text-xs tracking-widest opacity-60 mb-2 block font-bold">Director's Remarks</Label>
                    <textarea
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      placeholder="Principal's comments..."
                      className="w-full h-32 p-4 bg-transparent border-2 border-current/10 rounded-lg resize-none text-sm placeholder:italic focus:border-current transition-colors"
                    />
                 </div>
                  <div className="col-span-2 flex flex-col justify-end items-center relative h-40">
                     {/* Signatures */}
                     <div className="relative w-full h-24 mb-2 flex items-end justify-center">
                         {settings?.auto_attach_stamp && settings?.stamp_url && (
                           <img 
                             src={settings.stamp_url} 
                             className="h-24 w-24 object-contain opacity-90 rotate-[-8deg] mix-blend-multiply absolute right-4 bottom-0" 
                             alt="Official Stamp"
                           />
                         )}
                         {settings?.auto_attach_signature && (settings?.signature_url || activeSignature) && (
                            <img 
                              src={activeSignature || settings.signature_url || ""}
                              className="h-20 object-contain absolute bottom-4 select-none pointer-events-none"
                              alt="Principal Signature"
                            />
                         )}
                     </div>
                     <div className="w-full border-t-2 border-current pt-2 text-center">
                       <p className="text-xs uppercase tracking-[0.2em] font-bold">Director's Signature</p>
                     </div>
                  </div>
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
                  {previewTranscript.status === 'Published' ? 'Republish (Update)' : 'Publish Transcript'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold text-foreground">Transcript Management</h2>
           <p className="text-sm text-muted-foreground">Detailed transcript generation and publishing</p>
        </div>
        <div className="flex gap-2">
             <Button variant="outline" onClick={() => { fetchExistingTranscripts(); }} disabled={loading || !selectedExam || !selectedClass}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
             </Button>
        </div>
      </div>

      {/* NEW FILTERS: Class First */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card border border-border/50 rounded-xl p-6 shadow-sm">
        <div className="space-y-4">
          <Label className="text-base font-semibold">1. Select Class</Label>
          <Select value={selectedClass} onValueChange={(val) => { 
                setSelectedClass(val); 
                setSelectedExam(""); // Reset exam when class changes to avoid invalid state
            }}>
            <SelectTrigger className="h-12 bg-muted/50 border-border/50 text-base">
              <SelectValue placeholder="First, choose a class..." />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name} <span className="text-muted-foreground text-xs ml-2">({cls.form_level})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-semibold">2. Select Exam</Label>
          <Select value={selectedExam} onValueChange={setSelectedExam} disabled={!selectedClass}>
            <SelectTrigger className="h-12 bg-muted/50 border-border/50 text-base">
              <SelectValue placeholder={!selectedClass ? "Select a class first..." : "Now, choose an exam..."} />
            </SelectTrigger>
            <SelectContent>
              {exams.filter(e => 
                  // If exam has applicable_classes, allow only if selectedClass is in it.
                  // If applicable_classes is empty or undefined, show all (legacy support)
                  !e.applicable_classes || 
                  e.applicable_classes.length === 0 || 
                  e.applicable_classes.includes(selectedClass)
              ).map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.exam_name} ({exam.term} {exam.academic_year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Readiness Status */}
      {readiness && (
        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Class Readiness
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                readiness.completion_percentage === 100
                  ? "bg-green-500/20 text-green-500"
                  : "bg-amber-500/20 text-amber-500"
              }`}
            >
              {readiness.completion_percentage}% Complete
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-muted/30 p-4 rounded-xl text-center border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Total Students</p>
              <p className="text-3xl font-bold text-foreground">
                {readiness.total_students}
              </p>
            </div>
            <div className="bg-muted/30 p-4 rounded-xl text-center border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Data Status</p>
              <p className="text-3xl font-bold text-foreground">
                {transcripts.length > 0 ? `${transcripts.length} Generated` : "Not Generated"}
              </p>
            </div>
          </div>

          <Button
            onClick={() => handleGenerateTranscripts(transcripts.length > 0)}
            disabled={loading}
            className={`w-full h-12 text-base ${transcripts.length > 0 ? "bg-accent hover:bg-accent/90" : "bg-primary hover:bg-primary/90"}`}
          >
            <FileText className="w-5 h-5 mr-2" />
            {transcripts.length > 0 ? "Regenerate / Update Transcripts" : "Generate All Transcripts"}
          </Button>
           {transcripts.length > 0 && (
             <p className="text-xs text-center text-muted-foreground mt-2">
                Use "Regenerate" to update filtered drafts with latest marks. Published transcripts will be updated if you republish.
             </p>
           )}
        </div>
      )}
      
      {/* Transcript Results Toolbar */}
      {transcripts.length > 0 && (
         <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border/50">
            <Filter className="w-4 h-4 ml-2 text-muted-foreground" />
            <Button 
                variant={statusFilter === 'all' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setStatusFilter('all')}
            >
                All ({transcripts.length})
            </Button>
            <Button 
                variant={statusFilter === 'published' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setStatusFilter('published')}
                className="text-green-600"
            >
                Published ({transcripts.filter(t => t.status === 'Published').length})
            </Button>
            <Button 
                variant={statusFilter === 'draft' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setStatusFilter('draft')}
                className="text-amber-600"
            >
                Drafts ({transcripts.filter(t => t.status !== 'Published').length})
            </Button>
         </div>
      )}

      {/* Generated Transcripts List */}
      {transcripts.length > 0 && (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
           <div className="overflow-x-auto">
            <table className="w-full">
               <thead className="bg-muted/50 border-b border-border/50">
                  <tr>
                     <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Student</th>
                     <th className="text-center py-3 px-4 font-medium text-muted-foreground text-sm">Average</th>
                     <th className="text-center py-3 px-4 font-medium text-muted-foreground text-sm">Grade</th>
                     <th className="text-center py-3 px-4 font-medium text-muted-foreground text-sm">Pos</th>
                     <th className="text-center py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
                     <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border/50">
                  {filteredTranscripts
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((transcript) => (
                      <tr key={transcript.student_id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                           <p className="font-semibold text-foreground">{transcript.student_name}</p>
                           <p className="text-xs text-muted-foreground">{transcript.admission_number}</p>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                           {transcript.average_score.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                           <span className={`px-2 py-0.5 rounded text-xs ${
                             transcript.overall_grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                             transcript.overall_grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                             transcript.overall_grade.startsWith('C') ? 'bg-amber-100 text-amber-700' :
                             'bg-red-100 text-red-700'
                           }`}>
                             {transcript.overall_grade}
                           </span>
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                            {transcript.class_position}
                        </td>
                         <td className="py-3 px-4 text-center">
                            {transcript.status === 'Published' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Published
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full">
                                    <Lock className="w-3 h-3" /> Draft
                                </span>
                            )}
                        </td>
                        <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                            {transcript.status !== 'Published' && (
                                <Button
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(confirm("Are you sure you want to publish this transcript?")) {
                                            handlePublishTranscript(transcript);
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white h-8"
                                >
                                    <Send className="w-3 h-3 mr-1" />
                                    Publish
                                </Button>
                            )}
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => {
                                    setPreviewTranscript(transcript);
                                    fetchSettings(); 
                                }}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                {transcript.status === 'Published' ? 'View' : 'Preview'}
                            </Button>
                        </td>
                      </tr>
                    ))}
               </tbody>
            </table>
           </div>
           
           {/* Pagination */}
           {filteredTranscripts.length > itemsPerPage && (
               <div className="flex items-center justify-center gap-4 p-4 border-t border-border/50">
                    <Button 
                        size="sm" 
                        variant="outline"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(c => c - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {Math.ceil(filteredTranscripts.length / itemsPerPage)}
                    </span>
                    <Button 
                        size="sm" 
                        variant="outline"
                        disabled={currentPage >= Math.ceil(filteredTranscripts.length / itemsPerPage)}
                        onClick={() => setCurrentPage(c => c + 1)}
                    >
                        Next
                    </Button>
               </div>
           )}
        </div>
      )}
    </div>
  );
}
