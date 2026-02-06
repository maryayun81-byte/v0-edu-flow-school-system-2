"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Download,
  X,
  FileText,
  Calendar,
  Trophy,
  Printer,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Transcript {
  id: string;
  exam_id: string;
  exam_name: string;
  academic_year: number;
  term: string;
  exam_start_date: string;
  exam_end_date: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  total_score: number;
  average_score: number;
  overall_grade: string;
  class_position: number;
  admin_remarks: string;
  published_at: string;
  items: TranscriptItem[];
}

interface TranscriptItem {
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
}

interface StudentTranscriptViewerProps {
  transcriptId: string;
  onClose: () => void;
}

export default function StudentTranscriptViewer({
  transcriptId,
  onClose,
}: StudentTranscriptViewerProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTranscript();
    fetchSettings();
  }, [transcriptId]);

  async function fetchSettings() {
    const { data } = await supabase.from("school_settings").select("*").single();
    if (data) setSettings(data);
  }

  async function fetchTranscript() {
    try {
      // Fetch transcript with exam details
      const { data: transcriptData, error: transcriptError } = await supabase
        .from("transcripts")
        .select(`
          *,
          exams!inner(exam_name, academic_year, term, start_date, end_date),
          profiles!inner(full_name, admission_number, form_class)
        `)
        .eq("id", transcriptId)
        .eq("status", "Published")
        .single();

      if (transcriptError) throw transcriptError;

      // Fetch transcript items
      const { data: itemsData, error: itemsError } = await supabase
        .from("transcript_items")
        .select("*")
        .eq("transcript_id", transcriptId)
        .order("subject_name", { ascending: true });

      if (itemsError) throw itemsError;

      const fullTranscript: Transcript = {
        id: transcriptData.id,
        exam_id: transcriptData.exam_id,
        exam_name: transcriptData.exams.exam_name,
        academic_year: transcriptData.exams.academic_year,
        term: transcriptData.exams.term,
        exam_start_date: transcriptData.exams.start_date,
        exam_end_date: transcriptData.exams.end_date,
        student_name: transcriptData.profiles.full_name,
        admission_number: transcriptData.profiles.admission_number,
        class_name: transcriptData.profiles.form_class,
        total_score: transcriptData.total_score,
        average_score: transcriptData.average_score,
        overall_grade: transcriptData.overall_grade,
        class_position: transcriptData.class_position,
        admin_remarks: transcriptData.admin_remarks,
        published_at: transcriptData.published_at,
        items: itemsData || [],
      };

      setTranscript(fullTranscript);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      alert("Failed to load transcript");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPDF() {
    if (!transcriptRef.current || !transcript) return;

    try {
      const canvas = await html2canvas(transcriptRef.current, {
        scale: 2, // Higher scale for better quality
        useCORS: true, // Handle cross-origin images (like signatures)
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1600, // Force desktop width for responsive PDF generation
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // If content overflows (should be avoided by design, but handling it just in case)
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Transcript_${transcript.student_name.replace(/\s+/g, "_")}_${transcript.term}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  function getThemeClasses(theme: string = "Modern") {
    // Force specific width for PDF/Desktop consistency, handle mobile scaling via transform if needed
    // but for PDF generation we want the fixed mm width.
    const base = "w-[210mm] min-h-[297mm] mx-auto p-[15mm] relative bg-white shadow-2xl print:shadow-none print:w-full print:h-full print:m-0 object-contain mx-auto"; // A4 dimensions fixed
    switch(theme) {
      case "Classic": return `${base} font-serif border-[3px] border-double border-black`;
      case "Elegant": return `${base} font-serif bg-[#FFFAF0] text-slate-900 border-[6px] border-double border-amber-300`;
      case "Professional": return `${base} font-sans text-slate-800 border bg-[url('/bg-grid.png')]`; 
      case "Minimalist": return `${base} font-light text-neutral-600 tracking-wide`;
      case "Academic": return `${base} font-serif text-black border-[12px] border-double border-[#800000]/20`;
      case "Tech": return `${base} font-mono bg-slate-50 text-slate-900 border-l-8 border-slate-900`;
      case "Creative": return `${base} font-sans text-purple-900 rounded-3xl border-4 border-dashed border-purple-200`;
      default: return `${base} font-sans text-black`; // Modern
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!transcript) {
    return null;
  }

  return (
  const [showSubjects, setShowSubjects] = useState(false);

  // ... (existing imports and fetch logic) ...

  // Ensure imports include ChevronDown, ChevronUp, etc.
  // We will assume they are available or add them to the import list if editing the whole file. 
  // Since I am editing a chunk, I must be careful.
  // I will assume the user has the imports or I will add them if I can see the top.
  // I will replace the component from the `handleDownloadPDF` downwards or just the `return`.
  
  // Safe colors for PDF (replacing 'current' with explicit colors)
  const pdfSafeBorder = "border-gray-900";
  const pdfSafeText = "text-gray-900";

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto print:bg-white print:overflow-visible">
      
      {/* ---------------- MOBILE LAYOUT (Visible < md) ---------------- */}
      <div className="md:hidden pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
         {/* Mobile Header - Stacked */}
         <div className="bg-card p-6 border-b border-border/50 text-center space-y-3 shadow-sm pt-12">
            {settings?.logo_url && (
              <img src={settings.logo_url} className="h-20 w-20 object-contain mx-auto" alt="Logo" />
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground leading-tight">
                {settings?.school_name || "Peak Performance Tutoring"}
              </h2>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mt-1">Official Academic Transcript</p>
            </div>
            <div className="bg-muted/50 py-2 rounded-lg border border-border/50">
               <p className="font-semibold text-foreground">{transcript.exam_name}</p>
               <p className="text-sm text-muted-foreground">{transcript.term} • {transcript.academic_year}</p>
            </div>
         </div>

         <div className="p-4 space-y-6">
            {/* Student Info Card */}
            <div className="bg-card border border-border/50 rounded-xl p-5 shadow-sm space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Student Name</p>
                    <p className="font-semibold text-foreground">{transcript.student_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium uppercase">Admission No</p>
                    <p className="font-mono font-semibold text-foreground">{transcript.admission_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase">Class</p>
                    <p className="font-semibold text-foreground">{transcript.class_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium uppercase">Issued</p>
                    <p className="font-semibold text-foreground">{new Date(transcript.published_at).toLocaleDateString()}</p>
                  </div>
               </div>
            </div>

            {/* Summary Section - Always Visible */}
            <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 border-b border-primary/10 pb-2">mPerformance Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Total Score</p>
                        <p className="text-2xl font-black text-foreground">{transcript.total_score}</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Average</p>
                        <p className="text-2xl font-black text-foreground">{transcript.average_score.toFixed(1)}%</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3 col-span-2 flex items-center justify-between px-6">
                        <div>
                           <p className="text-xs text-muted-foreground mb-1">Grade</p>
                           <p className="text-2xl font-black text-primary">{transcript.overall_grade}</p>
                        </div>
                        <div className="h-8 w-px bg-border/50" />
                        <div>
                           <p className="text-xs text-muted-foreground mb-1">Position</p>
                           <p className="text-2xl font-black text-foreground flex items-center gap-2">
                             <Trophy className="w-5 h-5 text-amber-500" /> {transcript.class_position}
                           </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Collapsible Subjects */}
            <div className="space-y-3">
               <button 
                  onClick={() => setShowSubjects(!showSubjects)}
                  className="w-full flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg shadow-sm active:scale-[0.99] transition-all"
               >
                  <span className="font-semibold text-foreground">Subject Results ({transcript.items.length})</span>
                  {showSubjects ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
               </button>

               {showSubjects && (
                 <div className="grid gap-3 animate-in slide-in-from-top-2 duration-300">
                    {(transcript.items || []).map((item, index) => (
                      <div key={index} className="bg-card border border-border/50 rounded-xl p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                             <h4 className="font-bold text-foreground">{item.subject_name}</h4>
                             <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                               item.grade.startsWith('A') ? 'bg-green-100 text-green-700' : 
                               item.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                               'bg-gray-100 text-gray-700'
                             }`}>
                               {item.grade}
                             </div>
                          </div>
                          <div className="flex items-center justify-between text-sm mb-2">
                             <span className="text-muted-foreground">Score</span>
                             <span className="font-mono font-semibold">{item.score} / {item.max_score}</span>
                          </div>
                          {item.teacher_remarks && (
                             <div className="text-xs bg-muted/30 p-2 rounded mt-2">
                               <span className="font-semibold text-muted-foreground mr-1">Note:</span>
                               <span className="italic text-foreground/80">{item.teacher_remarks}</span>
                             </div>
                          )}
                      </div>
                    ))}
                 </div>
               )}
            </div>

             {/* Admin Remarks Read-Only */}
             {transcript.admin_remarks && (
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-5 shadow-sm">
                   <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Director's Remarks
                   </h3>
                   <p className="text-sm font-medium text-foreground italic leading-relaxed">
                      "{transcript.admin_remarks}"
                   </p>
                </div>
             )}

             <div className="text-center text-xs text-muted-foreground py-4">
                This is a digital preview. Download PDF for the official document.
             </div>
         </div>

         {/* Fixed Mobile Actions */}
         <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50">
            <div className="flex gap-3">
               <Button 
                 variant="outline" 
                 onClick={onClose}
                 className="flex-1 h-11"
               >
                 Close
               </Button>
               <Button 
                 onClick={handleDownloadPDF} 
                 className="flex-[2] h-11 shadow-lg bg-primary text-primary-foreground font-bold"
               >
                 {loading ? "Generating..." : "Download PDF"}
               </Button>
            </div>
         </div>
      </div>


      {/* ---------------- DESKTOP & PDF SOURCE (Visible md+, Hidden Offscreen < md) ---------------- */}
      <div className={`
         print:block 
         md:flex md:items-center md:justify-center md:p-4 md:min-h-screen
         absolute left-[-9999px] top-0 md:static md:left-auto md:top-auto
      `}>
          {/* Desktop Close Button (Floating) */}
          <div className="fixed top-4 right-4 hidden md:flex gap-2 z-50">
             <Button
                variant="default"
                onClick={handleDownloadPDF}
                className="shadow-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
             <Button
                variant="secondary"
                onClick={onClose}
                className="bg-white/90 backdrop-blur shadow-xl"
              >
                <X className="w-4 h-4" />
              </Button>
          </div>

        {/* The Actual Transcript (A4) - STRICT STYLING FOR PDF */}
        <div 
          ref={transcriptRef} 
          className={getThemeClasses(settings?.transcript_theme)}
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
        >
           {/* WATERMARK */}
           {settings?.logo_url && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
                 <img src={settings.logo_url} className="w-[500px] h-[500px] object-contain grayscale" />
              </div>
           )}

           <div className="relative z-10 flex flex-col h-full justify-between">
              
              {/* BRANDING HEADER */}
              <div className={`mb-8 border-b-[3px] ${pdfSafeBorder} pb-4`}>
                 <div className="flex items-center justify-between gap-4">
                   {settings?.logo_url && (
                     <img src={settings.logo_url} alt="School Logo" className="h-24 w-24 object-contain" />
                   )}
                   <div className="flex-1 text-center">
                      <h1 className={`text-3xl font-black uppercase tracking-widest mb-1 font-serif leading-tight ${pdfSafeText}`}>
                         {settings?.school_name || "Peak Performance Tutoring"}
                      </h1>
                      <div className={`text-[10px] uppercase tracking-[0.3em] opacity-70 mb-2 ${pdfSafeText}`}>Excellence • Integrity • Knowledge</div>
                      <div className="inline-block px-6 py-1 bg-black/5 rounded-sm">
                        <h2 className={`text-xl font-bold uppercase tracking-wide ${pdfSafeText}`}>Academic Transcript</h2>
                      </div>
                   </div>
                   <div className={`text-right text-[10px] opacity-70 w-24 space-y-1 ${pdfSafeText}`}>
                      <div className="flex items-center justify-end gap-1">
                          <Lock className="w-3 h-3 text-green-900" />
                          <span className="font-bold text-green-900">OFFICIAL</span>
                      </div>
                      <p>Issued: {new Date(transcript.published_at).toLocaleDateString()}</p>
                      <p>ID: {transcript.id.substring(0, 8).toUpperCase()}</p>
                   </div>
                 </div>
              </div>

              {/* STUDENT INFO & EXAM DETAILS */}
              <div className="bg-black/5 rounded-lg p-4 mb-6">
                <div className={`grid grid-cols-2 gap-x-8 gap-y-4 text-sm ${pdfSafeText}`}>
                   <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Student Name</p>
                      <p className={`font-bold text-base border-b ${pdfSafeBorder} border-opacity-20 pb-1`}>{transcript.student_name}</p>
                   </div>
                   <div>
                       <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Exam Session</p>
                       <p className={`font-bold text-base border-b ${pdfSafeBorder} border-opacity-20 pb-1`}>{transcript.exam_name}</p>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Admission No.</p>
                         <p className="font-semibold">{transcript.admission_number}</p>
                      </div>
                      <div>
                         <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Class</p>
                         <p className="font-semibold">{transcript.class_name}</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Term</p>
                          <p className="font-semibold">{transcript.term}</p>
                       </div>
                       <div>
                           <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Academic Year</p>
                           <p className="font-semibold">{transcript.academic_year}</p>
                       </div>
                   </div>
                </div>
              </div>

              {/* RESULTS TABLE */}
              <div className="flex-1 mb-6">
                 <table className={`w-full border-collapse text-sm ${pdfSafeText}`}>
                   <thead>
                     <tr className={`border-b-[2px] ${pdfSafeBorder} text-left`}>
                       <th className="py-2 font-bold uppercase tracking-wider text-[10px] w-1/2">Subject</th>
                       <th className="py-2 text-center font-bold uppercase tracking-wider text-[10px]">Score</th>
                       <th className="py-2 text-center font-bold uppercase tracking-wider text-[10px]">Grade</th>
                       <th className="py-2 text-right font-bold uppercase tracking-wider text-[10px] pl-4">Remarks</th>
                     </tr>
                   </thead>
                   <tbody className={`divide-y ${pdfSafeBorder} divide-opacity-20`}>
                     {(transcript.items || []).map((item, index) => (
                       <tr key={index} className={index % 2 === 0 ? "bg-black/[0.02]" : "bg-transparent"}>
                         <td className="py-2 px-2 font-medium">{item.subject_name}</td>
                         <td className="py-2 text-center font-mono">{item.score}</td>
                         <td className="py-2 text-center font-bold">{item.grade}</td>
                         <td className="py-2 text-right pr-2 italic opacity-80 text-xs">{item.teacher_remarks}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
              
              {/* SUMMARY METRICS */}
              <div className="flex justify-end mb-8">
                 <div className={`flex gap-6 border-y ${pdfSafeBorder} py-3 px-6 bg-black/5 rounded-lg ${pdfSafeText}`}>
                     <div className="text-center">
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Total Score</p>
                        <p className="text-2xl font-black">{transcript.total_score}</p>
                     </div>
                     <div className={`text-center px-6 border-x ${pdfSafeBorder} border-opacity-20`}>
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Average</p>
                        <p className="text-2xl font-black">{transcript.average_score.toFixed(1)}%</p>
                     </div>
                     <div className="text-center">
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Overall Grade</p>
                        <p className="text-2xl font-black text-gray-800">{transcript.overall_grade}</p>
                     </div>
                     <div className={`text-center pl-6 border-l ${pdfSafeBorder} border-opacity-20`}>
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Position</p>
                        <p className="text-2xl font-black flex items-center justify-center gap-1">
                          <Trophy className="w-4 h-4 text-amber-600" /> {transcript.class_position}
                        </p>
                     </div>
                 </div>
              </div>
              
              {/* FOOTER: REMARKS & SIGNATURES */}
              <div className={`grid grid-cols-5 gap-8 mt-auto pt-4 border-t ${pdfSafeBorder} border-opacity-30 ${pdfSafeText}`}>
                 <div className="col-span-3">
                    <p className="uppercase text-[10px] tracking-widest opacity-60 mb-2 font-bold">Director's Remarks</p>
                    <div className={`p-3 bg-black/[0.03] rounded border ${pdfSafeBorder} border-opacity-20 min-h-[80px]`}>
                      <p className="text-sm italic font-medium leading-relaxed">
                        "{transcript.admin_remarks || "Excellent performance. Keep it up."}"
                      </p>
                    </div>
                 </div>
                 
                 <div className="col-span-2 flex flex-col justify-end items-center">
                    <div className="relative w-full h-24 flex items-end justify-center">
                        {settings?.auto_attach_stamp && settings?.stamp_url && (
                          <img 
                            src={settings.stamp_url} 
                            className="h-24 w-24 object-contain opacity-90 rotate-[-8deg] mix-blend-multiply absolute right-4 bottom-0" 
                            alt="Official Stamp"
                          />
                        )}
                        {settings?.auto_attach_signature && settings?.signature_url && (
                           <img 
                             src={settings.signature_url}
                             className="h-24 object-contain absolute bottom-[-12px] select-none pointer-events-none z-10"
                             alt="Director Signature"
                           />
                        )}
                    </div>
                    <div className={`w-full border-t ${pdfSafeBorder} pt-1 text-center`}>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Director's Signature</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
