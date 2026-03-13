'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  ChevronLeft, ChevronRight, Save, Send, 
  CheckCircle2, AlertCircle, Loader2, BookOpen,
  User, Calendar, Trophy, MessageSquare, 
  Layout, FileText, ChevronDown, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import PremiumAnnotationEngine, { Annotation } from './PremiumAnnotationEngine';

const supabase = createClient();

interface WorksheetPage {
  id: string;
  page_number: number;
  header_title: string;
  footer_text: string;
  questions: any[];
}

interface StudentAnswer {
  id: string;
  question_id: string;
  answer_text?: string;
  answer_json?: any;
  uploaded_file_url?: string;
}

interface QuestionMarking {
  id?: string;
  question_id: string;
  marks_awarded: number;
  teacher_comment: string;
  annotation_data: Annotation[];
}

export default function PremiumWorksheetMarking({ 
  submissionId, 
  onClose,
  onReturn 
}: { 
  submissionId: string; 
  onClose: () => void;
  onReturn?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState<WorksheetPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [markings, setMarkings] = useState<Record<string, QuestionMarking>>({});
  const [submission, setSubmission] = useState<any>(null);
  const [annotatingQuestionId, setAnnotatingQuestionId] = useState<string | null>(null);
  
  // Global Feedback State
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [generalComment, setGeneralComment] = useState('');

  useEffect(() => {
    fetchSubmissionData();
  }, [submissionId]);

  async function fetchSubmissionData() {
    setLoading(true);
    try {
      // 1. Fetch Submission & Assignment info
      const { data: sub, error: subErr } = await supabase
        .from('student_submissions')
        .select(`
          *,
          profiles:student_id (full_name),
          assignments:assignment_id (id, title, total_marks)
        `)
        .eq('id', submissionId)
        .single();
      
      if (subErr) throw subErr;
      setSubmission(sub);

      const assignmentId = sub.assignment_id;

      // 2. Fetch Worksheet Structure
      const { data: pageData } = await supabase
        .from('assignment_pages')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('page_number', { ascending: true });

      const { data: questionData } = await supabase
        .from('assignment_questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      const enrichedPages = pageData?.map((page: any) => ({
        ...page,
        questions: questionData?.filter((q: any) => q.page_id === page.id) || []
      })) || [];
      setPages(enrichedPages);

      // 3. Fetch Student Answers
      const { data: answerData } = await supabase
        .from('student_question_answers')
        .select('*')
        .eq('submission_id', submissionId);
      
      const answerMap: Record<string, StudentAnswer> = {};
      answerData?.forEach(a => { answerMap[a.question_id] = a; });
      setAnswers(answerMap);

      // 4. Fetch Existing Markings
      const { data: markingData } = await supabase
        .from('question_markings')
        .select('*')
        .eq('submission_id', submissionId);
      
      const markingMap: Record<string, QuestionMarking> = {};
      markingData?.forEach(m => { 
        markingMap[m.question_id] = {
          ...m,
          annotation_data: Array.isArray(m.annotation_data) ? m.annotation_data : []
        }; 
      });
      setMarkings(markingMap);

      // 5. Set Global Feedback
      if (sub.strengths) setStrengths(sub.strengths);
      if (sub.weaknesses) setWeaknesses(sub.weaknesses);
      if (sub.improvement_suggestions) setImprovements(sub.improvement_suggestions);
      if (sub.teacher_remarks) setGeneralComment(sub.teacher_remarks);

    } catch (err: any) {
      toast.error('Failed to load marking session');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const updateMarking = (questionId: string, updates: Partial<QuestionMarking>) => {
    setMarkings(prev => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        marks_awarded: prev[questionId]?.marks_awarded ?? 0,
        teacher_comment: prev[questionId]?.teacher_comment ?? '',
        annotation_data: prev[questionId]?.annotation_data ?? [],
        ...updates
      }
    }));
  };

  const saveMarkings = async (finalize = false) => {
    setSaving(true);
    try {
      const markingList = Object.values(markings);
      if (markingList.length > 0) {
        const { error } = await supabase.from('question_markings').upsert(
          markingList.map(m => ({
            submission_id: submissionId,
            question_id: m.question_id,
            marks_awarded: m.marks_awarded,
            teacher_comment: m.teacher_comment,
            annotation_data: m.annotation_data
          })),
          { onConflict: 'submission_id,question_id' }
        );
        if (error) throw error;
      }

      if (finalize) {
        const totalAwarded = Object.values(markings).reduce((sum, m) => sum + (m.marks_awarded || 0), 0);
        await supabase
          .from('student_submissions')
          .update({
            status: 'RETURNED',
            score: totalAwarded,
            returned_at: new Date().toISOString(),
            strengths,
            weaknesses,
            improvement_suggestions: improvements,
            teacher_remarks: generalComment
          })
          .eq('id', submissionId);
        
        toast.success('Assignment returned to student successfully');
        onReturn?.();
        onClose();
      } else {
        toast.success('Markings saved as draft');
      }
    } catch (err) {
      toast.error('Failed to save markings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
     return (
       <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400 bg-[#0a0c10]">
         <Loader2 className="w-12 h-12 animate-spin" />
         <p className="font-black uppercase tracking-widest text-xs">Opening Gradebook...</p>
       </div>
     );
  }

  const activePage = pages[activePageIndex];
  const activeQuestions = activePage.questions;

  return (
    <div className="flex flex-col h-full bg-[#0a0c10]">
      {/* ── HEADER ── */}
      <div className="h-20 bg-[#0f1117] border-b border-white/5 px-8 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="h-8 w-px bg-white/5" />
          <div>
             <h1 className="text-sm font-black text-indigo-400 uppercase tracking-tight">{submission?.assignments?.title}</h1>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                <User className="w-3 h-3" /> {submission?.profiles?.full_name}
             </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 px-6 py-2 bg-slate-900 border border-white/5 rounded-xl">
             <div className="text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase">Current Score</p>
                <p className="text-lg font-black text-emerald-400 leading-tight">
                   {Object.values(markings).reduce((sum, m) => sum + (m.marks_awarded || 0), 0)}
                   <span className="text-xs text-slate-600 ml-1">/ {submission?.assignments?.total_marks}</span>
                </p>
             </div>
          </div>
          <button 
            onClick={() => saveMarkings(true)}
            disabled={saving}
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
             {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
             Return Result
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* ── LEFT PANEL: QUESTIONS LIST ── */}
         <div className="w-80 bg-[#0f1117] border-r border-white/5 flex flex-col shrink-0">
            <div className="p-6 border-b border-white/5">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <Layout className="w-3 h-3 text-indigo-400" /> Page Exploration
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
               {pages.map((p, idx) => (
                 <div 
                   key={p.id}
                   onClick={() => setActivePageIndex(idx)}
                   className={cn(
                     "p-4 rounded-xl border cursor-pointer transition-all",
                     activePageIndex === idx 
                       ? "bg-indigo-500/10 border-indigo-500/50" 
                       : "bg-transparent border-transparent hover:bg-white/5"
                   )}
                 >
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-white">Phase {p.page_number}</span>
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.questions.length} Units</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-1">{p.header_title}</p>
                 </div>
               ))}
            </div>
            <div className="p-6 bg-[#0a0c10] border-t border-white/5">
               <button 
                 onClick={() => saveMarkings(false)}
                 disabled={saving}
                 className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all border border-white/5"
               >
                  <Save className="w-4 h-4" /> Save Progress
               </button>
            </div>
         </div>

         {/* ── MAIN CONTENT: QUESTION GRADING ── */}
         <div className="flex-1 overflow-y-auto bg-[#0a0c10] pattern-grid p-12 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12 pb-24">
               
               {activeQuestions.map((q, qIdx) => (
                 <div key={q.id} className="relative group">
                    <div className="absolute -left-12 top-0 py-2 text-slate-800 font-black text-4xl select-none group-hover:text-indigo-500/20 transition-colors">
                       {q.order_index + 1}
                    </div>

                    <div className="bg-[#0f1117] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 hover:border-indigo-500/30">
                       {/* Header & Question Detail */}
                       <div className="p-8 border-b border-white/5">
                          <div className="flex items-center justify-between mb-6">
                             <div className="flex items-center gap-3">
                                <div className="px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                   Question Blueprint
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{q.question_type} unit</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-slate-600 uppercase">Max Points: {q.marks}</span>
                                <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-white/5">
                                   <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                   <input 
                                     type="number" 
                                     value={markings[q.id]?.marks_awarded ?? 0}
                                     max={q.marks}
                                     min={0}
                                     onChange={(e) => updateMarking(q.id, { marks_awarded: Number(e.target.value) })}
                                     className="w-10 bg-transparent text-white font-black text-sm focus:outline-none"
                                   />
                                   <span className="text-[10px] font-black text-slate-500 uppercase">PTS</span>
                                </div>
                             </div>
                          </div>
                          
                          <p className="text-lg font-medium text-slate-200 leading-relaxed">{q.question_text}</p>
                       </div>

                       {/* Student Answer View */}
                       <div className="p-8 bg-slate-900/40">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <FileText className="w-3 h-3 text-emerald-400" /> Inbound Response
                          </h3>
                          <div className="p-6 bg-slate-950/50 border border-white/5 rounded-2xl">
                             {answers[q.id]?.answer_text ? (
                                <p className="text-slate-300 italic">"{answers[q.id].answer_text}"</p>
                             ) : answers[q.id]?.answer_json ? (
                                <div className="flex flex-wrap gap-2">
                                   {Array.isArray(answers[q.id].answer_json) && answers[q.id].answer_json.map((opt: string, i: number) => (
                                     <span key={i} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">
                                        {opt}
                                     </span>
                                   ))}
                                </div>
                             ) : (
                                <p className="text-slate-600 text-xs italic">No digital footprint found for this unit.</p>
                             )}
                          </div>
                       </div>

                       {/* Annotation Area (Manual triggering) */}
                       <div className="p-8 border-t border-white/5 space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annotation Layer</h3>
                            {markings[q.id]?.annotation_data?.length ? (
                               <span className="text-[9px] font-black text-amber-400 uppercase flex items-center gap-1">
                                  <Check className="w-3 h-3" /> {markings[q.id].annotation_data.length} Marks Encrypted
                               </span>
                            ) : (
                               <span className="text-[9px] font-black text-rose-500 uppercase">Attention Required</span>
                            )}
                          </div>

                          <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                   <BookOpen className="w-6 h-6" />
                                </div>
                                <div>
                                   <p className="text-xs font-black text-white uppercase tracking-tight">Launch Visualization Engine</p>
                                   <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-widest">Apply Ticks, Crosses & Comments</p>
                                </div>
                             </div>
                             <button 
                               onClick={() => setAnnotatingQuestionId(q.id)}
                               className="px-6 py-2.5 bg-slate-900 hover:bg-indigo-500 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                             >
                                Open Canvas
                             </button>
                          </div>

                          <div className="space-y-3">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expert Evaluation</p>
                             <textarea 
                               value={markings[q.id]?.teacher_comment ?? ''}
                               onChange={(e) => updateMarking(q.id, { teacher_comment: e.target.value })}
                               placeholder="Draft your professional feedback for this specific unit..."
                               rows={3}
                               className="w-full bg-slate-950/30 border border-white/5 rounded-2xl p-4 text-xs italic text-indigo-300 placeholder:text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
                             />
                          </div>
                       </div>
                    </div>
                 </div>
               ))}

            </div>
         </div>

          {/* ── RIGHT PANEL: GLOBAL FEEDBACK ── */}
          <div className="w-96 bg-[#0f1117] border-l border-white/5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-8 space-y-8">
             <div>
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                   <Star className="w-4 h-4 text-amber-400" /> Strategic Intelligence Report
                </h3>
                
                <div className="space-y-6">
                   {/* Strengths */}
                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Cognitive Strengths</label>
                      <div className="flex flex-wrap gap-2">
                         {strengths.map((s, i) => (
                           <span key={i} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg flex items-center gap-2">
                              {s}
                              <button onClick={() => setStrengths(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                           </span>
                         ))}
                         <input 
                           placeholder="+ Add strength"
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               const val = (e.target as HTMLInputElement).value;
                               if (val) setStrengths(prev => [...prev, val]);
                               (e.target as HTMLInputElement).value = '';
                             }
                           }}
                           className="bg-transparent border-b border-white/5 text-[10px] py-1 focus:outline-none focus:border-emerald-500 transition-all w-24"
                         />
                      </div>
                   </div>

                   {/* Weaknesses */}
                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Performance Gaps</label>
                      <div className="flex flex-wrap gap-2">
                         {weaknesses.map((w, i) => (
                           <span key={i} className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg flex items-center gap-2">
                              {w}
                              <button onClick={() => setWeaknesses(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                           </span>
                         ))}
                         <input 
                           placeholder="+ Add weakness"
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               const val = (e.target as HTMLInputElement).value;
                               if (val) setWeaknesses(prev => [...prev, val]);
                               (e.target as HTMLInputElement).value = '';
                             }
                           }}
                           className="bg-transparent border-b border-white/5 text-[10px] py-1 focus:outline-none focus:border-rose-500 transition-all w-24"
                         />
                      </div>
                   </div>

                   {/* Improvement Suggestions */}
                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Tactical Improvements</label>
                      <div className="flex flex-wrap gap-2">
                         {improvements.map((imp, i) => (
                           <span key={i} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-lg flex items-center gap-2">
                              {imp}
                              <button onClick={() => setImprovements(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></button>
                           </span>
                         ))}
                         <input 
                           placeholder="+ Add improvement"
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               const val = (e.target as HTMLInputElement).value;
                               if (val) setImprovements(prev => [...prev, val]);
                               (e.target as HTMLInputElement).value = '';
                             }
                           }}
                           className="bg-transparent border-b border-white/5 text-[10px] py-1 focus:outline-none focus:border-indigo-500 transition-all w-24"
                         />
                      </div>
                   </div>

                   <div className="h-px bg-white/5" />

                   <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Executive Summary</label>
                      <textarea 
                        value={generalComment}
                        onChange={(e) => setGeneralComment(e.target.value)}
                        placeholder="Consolidate mission feedback..."
                        rows={6}
                        className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-xs text-slate-300 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none italic leading-relaxed"
                      />
                   </div>
                </div>
             </div>
          </div>
       </div>

      {annotatingQuestionId && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
           <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0c10]">
              <div className="flex items-center gap-4">
                 <button onClick={() => setAnnotatingQuestionId(null)} className="p-2 text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                 </button>
                 <h2 className="text-sm font-black text-white uppercase tracking-widest">Question {activeQuestions.findIndex(q => q.id === annotatingQuestionId) + 1} Annotation Layer</h2>
              </div>
              <button 
                onClick={() => setAnnotatingQuestionId(null)}
                className="px-6 py-2 bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
              >
                 Done Marking
              </button>
           </div>
           <div className="flex-1 overflow-hidden">
              <PremiumAnnotationEngine 
                imageUrl="https://images.unsplash.com/photo-1586075010633-244414ec373c?q=80&w=2000" // Placeholder background
                initialAnnotations={markings[annotatingQuestionId]?.annotation_data || []}
                onSave={(data) => {
                  updateMarking(annotatingQuestionId, { annotation_data: data });
                }}
              />
           </div>
        </div>
      )}
    </div>
  );
}
