"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  X, Calculator, Info, 
  ChevronRight, AlertCircle, 
  TrendingUp, TrendingDown, Minus,
  Loader2, Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultsCognitiveCore } from "@/lib/ai/ResultsCognitiveCore";
import { toast } from "sonner";

const supabase = createClient();

interface ResultsSubmissionModalProps {
  studentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const GRADES_CBC = ["A", "B", "C", "D", "E"];
const GRADES_844 = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E"];

export default function ResultsSubmissionModal({ studentId, onClose, onSuccess }: ResultsSubmissionModalProps) {
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [manualOverallGrade, setManualOverallGrade] = useState<string>("");
  const [manualPreviousGrade, setManualPreviousGrade] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    try {
      const event = await ResultsCognitiveCore.getActiveEvent();
      if (!event) {
        onClose();
        return;
      }
      setActiveEvent(event);

      const { data: existing } = await supabase
        .from('student_results')
        .select('id')
        .eq('student_id', studentId)
        .eq('event_id', event.id)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.info("You have already submitted results for this event.");
        onClose();
        return;
      }

      // 3. Get student registered subjects ONLY
      const { data: subData } = await supabase
        .from('student_subjects')
        .select('subject_name')
        .eq('student_id', studentId);
      
      setSubjects(subData || []);

      // 4. Fetch previous overall grade for baseline
      const { data: prevResults } = await supabase
        .from('student_results')
        .select('overall_grade')
        .eq('student_id', studentId)
        .neq('event_id', event.id)
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (prevResults && prevResults.length > 0) {
        setManualPreviousGrade(prevResults[0].overall_grade);
      }

    } catch (error) {
      console.error("Error fetching submission data:", error);
      toast.error("Failed to load submission form.");
    } finally {
      setLoading(false);
    }
  }

  function handleGradeChange(subjectName: string, grade: string) {
    setGrades(prev => ({ ...prev, [subjectName]: grade }));
  }

  // Auto-calculated reference for student guidance
  const suggestedGrade = (() => {
    const selectedGrades = Object.values(grades);
    if (selectedGrades.length === 0) return "-";
    const totalWeight = selectedGrades.reduce((sum, g) => sum + ResultsCognitiveCore.gradeToNumeric(g), 0);
    const avg = totalWeight / selectedGrades.length;
    const list = activeEvent?.curriculum_type === 'CBC' ? GRADES_CBC : GRADES_844;
    let closest = list[0];
    let minDiff = Math.abs(avg - ResultsCognitiveCore.gradeToNumeric(closest));
    for (const g of list) {
        const diff = Math.abs(avg - ResultsCognitiveCore.gradeToNumeric(g));
        if (diff < minDiff) { minDiff = diff; closest = g; }
    }
    return closest;
  })();

  const comparison = (manualOverallGrade && manualPreviousGrade) ? 
    ResultsCognitiveCore.gradeToNumeric(manualOverallGrade) - ResultsCognitiveCore.gradeToNumeric(manualPreviousGrade) : 0;

  async function handleSubmit() {
    if (!manualOverallGrade) {
      toast.warning("Please select your current Overall Grade.");
      return;
    }
    if (!manualPreviousGrade) {
      toast.warning("Please select your previous Overall Grade.");
      return;
    }
    if (Object.keys(grades).length < subjects.length) {
      toast.warning(`Please enter grades for all ${subjects.length} registered subjects.`);
      return;
    }

    setSubmitting(true);
    try {
      const resultsToInsert = subjects.map(s => ({
        student_id: studentId,
        event_id: activeEvent.id,
        subject_name: s.subject_name,
        grade: grades[s.subject_name],
        overall_grade: manualOverallGrade,
        previous_overall_grade: manualPreviousGrade
      }));

      const { error } = await supabase.from('student_results').insert(resultsToInsert);
      if (error) throw error;

      toast.success("Results successfully pushed to Intelligence Core!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit results.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const gradesList = activeEvent?.curriculum_type === 'CBC' ? GRADES_CBC : GRADES_844;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xl">
      <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] w-full max-w-xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-500 backdrop-blur-2xl flex flex-col max-h-[90vh]">
        {/* Header Section - Sleeker */}
        <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase">Academic Intake</h2>
              <p className="text-[9px] text-indigo-300 font-black uppercase tracking-[0.2em] opacity-60">{activeEvent?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all group">
            <X className="w-5 h-5 text-slate-400 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          {/* Performance Intelligence Block - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-3xl p-6 border border-white/5 shadow-inner">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Current Grade</span>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                    comparison > 0 ? 'bg-emerald-500/10 text-emerald-400' : 
                    comparison < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-white/5 text-slate-500'
                  }`}>
                    {comparison > 0 ? <TrendingUp className="w-3 h-3" /> : comparison < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {comparison === 0 ? 'STABLE' : `${Math.abs(comparison * 10).toFixed(0)}% Shift`}
                  </div>
               </div>
               
               <select 
                 value={manualOverallGrade}
                 onChange={(e) => setManualOverallGrade(e.target.value)}
                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl font-black text-white hover:border-indigo-500/30 outline-none transition-all appearance-none cursor-pointer"
               >
                 <option value="" disabled>SELECT</option>
                 {gradesList.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
               <p className="text-[8px] text-slate-500/80 font-black mt-3 uppercase tracking-widest text-center">Basis: {suggestedGrade}</p>
            </div>

            <div className="bg-white/5 rounded-3xl p-6 border border-white/5 shadow-inner">
               <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block mb-4">Previous Baseline</span>
               <select 
                 value={manualPreviousGrade}
                 onChange={(e) => setManualPreviousGrade(e.target.value)}
                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl font-black text-white hover:border-indigo-500/30 outline-none transition-all appearance-none cursor-pointer"
               >
                 <option value="" disabled>SELECT</option>
                 {gradesList.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
               <p className="text-[8px] text-indigo-500/60 font-black mt-3 uppercase tracking-widest text-center">Historical Required</p>
            </div>
          </div>

          {/* Subject Assessment Matrix - 2 Column Desktop Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Module Synchronization</h3>
               </div>
               <span className="text-[8px] font-black text-slate-500 uppercase px-2 py-0.5 bg-white/5 rounded-full">{subjects.length} Discs</span>
            </div>

            {subjects.length === 0 ? (
              <div className="p-12 bg-black/20 border-2 border-dashed border-white/5 rounded-3xl text-center">
                 <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">No subject registrations detected.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subjects.map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl hover:bg-black/40 transition-all group">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide truncate max-w-[100px]">{sub.subject_name}</span>
                    <select
                      value={grades[sub.subject_name] || ""}
                      onChange={(e) => handleGradeChange(sub.subject_name, e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-black text-indigo-400 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="" disabled>GR</option>
                      {gradesList.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer - Sleeker */}
        <div className="p-6 md:p-8 bg-black/40 border-t border-white/5 flex gap-4 shrink-0">
          <Button
            variant="ghost"
            className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all"
            onClick={onClose}
          >
            Abort
          </Button>
          <Button
            className="flex-[2] h-12 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transform transition-all active:scale-95 gap-2"
            disabled={submitting || subjects.length === 0}
            onClick={handleSubmit}
          >
            {submitting ? (
               <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
               <>
                 Sync to Core
                 <ChevronRight className="w-4 h-4" />
               </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
