'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  ChevronLeft, ChevronRight, Save, Send, 
  Clock, AlertCircle, Loader2, CheckCircle2,
  FileText, Image as ImageIcon, Pencil, List,
  CheckSquare, Type, Hash, HelpCircle, Layout,
  MessageCircle, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import { useRef, useLayoutEffect } from 'react';
import PremiumAnnotationEngine from './PremiumAnnotationEngine';

const supabase = createClient();

// Add a helper for rendering math
function MathContent({ content, className }: { content: string, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      try {
        renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
      }
    }
  }, [content]);

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: content }} />;
}

interface WorksheetPage {
  id: string;
  page_number: number;
  header_title: string;
  footer_text: string;
  questions: any[];
}

interface Answer {
  question_id: string;
  answer_text?: string;
  answer_json?: any;
  uploaded_file_url?: string;
  is_answered: boolean;
}

export default function PremiumWorksheetPlayer(props: { 
  assignmentId: string; 
  studentId: string;
  submissionId?: string;
  onClose: () => void;
  onSubmit?: () => void;
  reviewMode?: boolean;
  isPreview?: boolean;
}) {
  const { 
    assignmentId, 
    studentId, 
    submissionId: initialSubmissionId, 
    onClose, 
    onSubmit, 
    reviewMode, 
    isPreview 
  } = props;
  const [pages, setPages] = useState<WorksheetPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(initialSubmissionId || null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [markings, setMarkings] = useState<Record<string, any>>({});
  const [viewingAnnotationsId, setViewingAnnotationsId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    fetchWorksheetAndAnswers();
  }, [assignmentId, studentId]);

  async function fetchWorksheetAndAnswers() {
    setLoading(true);
    try {
      // 1. Fetch Worksheet Structure
      const { data: pageData, error: pageError } = await supabase
        .from('assignment_pages')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('page_number', { ascending: true });

      if (pageError) throw pageError;

      const { data: questionData, error: questionError } = await supabase
        .from('assignment_questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      if (questionError) throw questionError;

      const enrichedPages = pageData.map((page: any) => ({
        ...page,
        questions: questionData?.filter((q: any) => q.page_id === page.id) || []
      }));
      setPages(enrichedPages);

      // 2. Fetch or Create Submission (Skip if preview)
      if (isPreview) {
        setLoading(false);
        return;
      }

      let currentSubId = submissionId;
      if (!currentSubId) {
        const { data: existingSub } = await supabase
          .from('student_submissions')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .maybeSingle();
        
        if (existingSub) {
          currentSubId = existingSub.id;
        } else {
          const { data: newSub, error: subError } = await supabase
            .from('student_submissions')
            .insert({
              assignment_id: assignmentId,
              student_id: studentId,
              status: 'NOT_SUBMITTED',
              submission_mode: 'ONLINE',
              is_draft: true
            })
            .select()
            .single();
          if (subError) throw subError;
          currentSubId = newSub.id;
        }
        setSubmissionId(currentSubId);
      }

      // 3. Fetch Existing Answers
      if (currentSubId) {
        const { data: answerData } = await supabase
          .from('student_question_answers')
          .select('*')
          .eq('submission_id', currentSubId);
        
        if (answerData) {
          const answerMap: Record<string, Answer> = {};
          answerData.forEach((a: any) => {
            answerMap[a.question_id] = {
              question_id: a.question_id,
              answer_text: a.answer_text,
              answer_json: a.answer_json,
              uploaded_file_url: a.uploaded_file_url,
              is_answered: a.is_answered
            };
          });
          setAnswers(answerMap);
        }

        // 4. Fetch Markings (if in review mode or already submitted)
        const { data: markingData } = await supabase
          .from('question_markings')
          .select('*')
          .eq('submission_id', currentSubId);
        
        if (markingData) {
          const markingMap: Record<string, any> = {};
          markingData.forEach((m: any) => { markingMap[m.question_id] = m; });
          setMarkings(markingMap);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load worksheet');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswer(questionId: string, answerData: any) {
    if (reviewMode || isPreview || !submissionId) return;
    try {
      const { error } = await supabase
        .from('student_question_answers')
        .upsert(
          {
            submission_id: submissionId,
            question_id: questionId,
            answer_text: answerData.answer_text,
            answer_json: answerData.answer_json,
            uploaded_file_url: answerData.uploaded_file_url,
            is_answered: answerData.is_answered,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'submission_id,question_id' }
        );
      if (error) throw error;
      setLastSaved(new Date());
    } catch (err) {
      console.error('Single answer save error:', err);
    }
  }

  const updateAnswer = (questionId: string, updates: Partial<Answer>) => {
    if (reviewMode) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        is_answered: true,
        ...updates
      }
    }));
    // Proactive auto-save debounced would be better, but let's do simple save for now
  };

  const saveAnswers = async () => {
    if (!submissionId || isPreview) return;
    try {
      const answerList = Object.values(answers);
      if (answerList.length === 0) return;

      const { error } = await supabase
        .from('student_question_answers')
        .upsert(
          answerList.map((a: Answer) => ({
            submission_id: submissionId,
            question_id: a.question_id,
            answer_text: a.answer_text,
            answer_json: a.answer_json,
            uploaded_file_url: a.uploaded_file_url,
            is_answered: a.is_answered,
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'submission_id,question_id' }
        );

      if (error) throw error;
      setLastSaved(new Date());
    } catch (err) {
      console.error('Auto-save error:', err);
    }
  };

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAnswers();
    }, 3000);
    return () => clearTimeout(timer);
  }, [answers]);

  const submitWorksheet = async () => {
    if (!submissionId || submitting || isPreview) return;
    setSubmitting(true);
    try {
      await saveAnswers();
      
      const { error } = await supabase
        .from('student_submissions')
        .update({
          status: 'SUBMITTED',
          is_draft: false,
          submitted_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;
      
      toast.success('Worksheet submitted successfully!');
      onSubmit?.();
      onClose();
    } catch (err) {
      toast.error('Failed to submit worksheet');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePageChange = (index: number) => {
    saveAnswers();
    setActivePageIndex(index);
  };

  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contentRef.current) {
      renderMathInElement(contentRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
    }
  }, [activePageIndex, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400 bg-[#0a0c10]">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="font-black uppercase tracking-widest text-xs">Unlocking Worksheet Vault...</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0a0c10] text-slate-200">
        <div className="bg-[#0f1117] border-b border-slate-800 p-4 sm:px-8 sm:h-20 flex flex-col sm:flex-row items-center justify-between z-10 w-full h-20">
          <div className="flex items-center gap-4">
             <button 
               onClick={onClose}
               className="p-2 -ml-2 sm:ml-0 text-slate-400 hover:text-white transition-colors shrink-0"
             >
               <ChevronLeft className="w-6 h-6" />
             </button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 space-y-4">
           <AlertCircle className="w-12 h-12 text-slate-500" />
           <p className="text-slate-400 font-bold">No interactive pages found for this assignment.</p>
        </div>
      </div>
    );
  }

  const activePage = pages[activePageIndex];
  const progress = (Object.keys(answers).length / pages.reduce((acc, p) => acc + p.questions.length, 0)) * 100;

  const worksheetTotalMarks = Math.max(1, pages.reduce((sum, p) => sum + p.questions.reduce((qSum, q) => qSum + (q.marks || 0), 0), 0));
  const studentScore = Object.values(markings).reduce((sum, m) => sum + (m.marks_awarded || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#0a0c10] text-slate-200">
      {/* ── HEADER ── */}
      <div className="bg-[#0f1117] border-b border-slate-800 p-4 sm:px-8 sm:h-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 sm:ml-0 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="hidden sm:block h-8 w-px bg-slate-800" />
          <div className="min-w-0 flex-1">
             <h1 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate w-full">{activePage.header_title}</h1>
             <div className="flex items-center gap-2 mt-1">
                <div className="w-24 sm:w-32 h-1 bg-slate-800 rounded-full overflow-hidden shrink-0">
                   <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{Math.round(progress)}% Complete</span>
             </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
          {reviewMode && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shrink-0 mr-2">
                <Star className="w-4 h-4 text-emerald-400 hidden sm:block" />
                <span className="text-xs font-black text-emerald-400">Score: {studentScore}/{worksheetTotalMarks}</span>
             </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50 text-[10px] font-bold text-slate-500 uppercase shrink-0">
             <Clock className="w-3 h-3 hidden sm:block" />
             <span className="truncate max-w-[100px] sm:max-w-none">
                {lastSaved ? `Synced ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced'}
             </span>
          </div>
          <button 
            onClick={() => {
              if (reviewMode || isPreview) submitWorksheet();
              else setShowReviewModal(true);
            }}
            disabled={submitting}
            className="px-4 sm:px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 shrink-0"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">{reviewMode ? 'Viewing Graded Work' : 'Submit Work'}</span>
            <span className="sm:hidden">{reviewMode ? 'View' : 'Submit'}</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto bg-[#0a0c10] pattern-grid py-12 px-4 sm:px-8"
      >
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* Questions */}
          {activePage.questions.map((q, idx) => (
             <div 
               key={q.id}
               className="bg-[#0f1117] border border-slate-800 rounded-[2rem] p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500"
               style={{ animationDelay: `${idx * 100}ms` }}
             >
                <div className="flex items-start justify-between mb-6">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 font-black">
                         {q.order_index + 1}
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{q.question_type === 'content_block' ? 'Reading Passage' : 'Question Module'}</p>
                         {q.question_type !== 'content_block' && (
                           <p className="text-indigo-400 font-bold text-xs">{q.marks} Marks Available</p>
                         )}
                      </div>
                   </div>
                   {answers[q.id]?.is_answered && q.question_type !== 'content_block' && (
                     <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                     </div>
                   )}
                </div>

                <div className="prose prose-invert max-w-none mb-8">
                   <MathContent 
                     content={q.question_text.replace(/\n/g, '<br/>')} 
                     className={cn(
                       "text-lg font-medium text-slate-100 leading-relaxed",
                       q.question_type === 'content_block' ? "font-serif text-slate-300" : ""
                     )} 
                   />
                </div>

                {/* Answer Inputs */}
                <div className="space-y-4">
                   {q.question_type === 'text' && (
                     <input 
                       type="text"
                       disabled={reviewMode}
                       value={answers[q.id]?.answer_text || ''}
                       onChange={(e) => updateAnswer(q.id, { answer_text: e.target.value })}
                       placeholder="Draft your response..."
                       className="w-full bg-[#0a0c10] border border-slate-800 rounded-xl px-6 py-4 text-slate-200 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all font-medium disabled:opacity-70"
                     />
                   )}

                   {q.question_type === 'paragraph' && (
                     <textarea 
                       rows={8}
                       disabled={reviewMode}
                       value={answers[q.id]?.answer_text || ''}
                       onChange={(e) => updateAnswer(q.id, { answer_text: e.target.value })}
                       placeholder="Compose your detailed analysis..."
                       className="w-full bg-[#0a0c10] border border-slate-800 rounded-2xl px-6 py-4 text-slate-200 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all font-medium resize-y min-h-[120px] disabled:opacity-70"
                     />
                   )}

                   {q.question_type === 'multiple_choice' && (
                     <div className="grid gap-3">
                        {q.options.map((opt: string, optIdx: number) => (
                          <button
                            key={optIdx}
                            onClick={() => updateAnswer(q.id, { answer_text: opt })}
                            className={cn(
                              "flex items-center gap-4 px-6 py-4 rounded-2xl border transition-all text-left",
                              answers[q.id]?.answer_text === opt 
                                ? "bg-indigo-500/10 border-indigo-500/50 text-white" 
                                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                            )}
                          >
                             <div className={cn(
                               "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                               answers[q.id]?.answer_text === opt ? "border-indigo-500" : "border-slate-700"
                             )}>
                                {answers[q.id]?.answer_text === opt && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                             </div>
                             <span className="font-medium">{opt}</span>
                          </button>
                        ))}
                     </div>
                   )}

                   {q.question_type === 'checkbox' && (
                     <div className="grid gap-3">
                        {q.options.map((opt: string, optIdx: number) => {
                          const currentOptions = Array.isArray(answers[q.id]?.answer_json) ? answers[q.id]?.answer_json : [];
                          const isSelected = currentOptions.includes(opt);
                          return (
                            <button
                              key={optIdx}
                              onClick={() => {
                                const newOpts = isSelected 
                                  ? currentOptions.filter((o: string) => o !== opt)
                                  : [...currentOptions, opt];
                                updateAnswer(q.id, { answer_json: newOpts });
                              }}
                              className={cn(
                                "flex items-center gap-4 px-6 py-4 rounded-2xl border transition-all text-left",
                                isSelected 
                                  ? "bg-indigo-500/10 border-indigo-500/50 text-white" 
                                  : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                              )}
                            >
                               <div className={cn(
                                 "w-5 h-5 rounded border-2 flex items-center justify-center",
                                 isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-700"
                               )}>
                                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                               </div>
                               <span className="font-medium">{opt}</span>
                            </button>
                          );
                        })}
                     </div>
                   )}

                   {q.hint && (
                     <div className="mt-6 flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-emerald-400 leading-relaxed italic">
                           Expert Guidance: {q.hint}
                        </p>
                     </div>
                   )}

                   {reviewMode && markings[q.id] && (
                     <div className="mt-8 pt-8 border-t border-slate-800 space-y-6">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <Star className="w-5 h-5 text-amber-400" />
                              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Teacher Evaluation</h4>
                           </div>
                           <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                              <span className="text-emerald-400 font-black text-sm">{markings[q.id].marks_awarded} / {q.marks}</span>
                           </div>
                        </div>
                        
                        {markings[q.id].teacher_comment && (
                           <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                              <div className="flex items-start gap-4">
                                 <MessageCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                                 <p className="text-sm italic text-indigo-300 leading-relaxed">
                                    "{markings[q.id].teacher_comment}"
                                 </p>
                              </div>
                           </div>
                        )}

                         {markings[q.id].annotation_data?.length > 0 && (
                           <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Visual Annotations applied</span>
                              <button 
                                onClick={() => setViewingAnnotationsId(q.id)}
                                className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors"
                              >
                                View Annotations
                              </button>
                           </div>
                         )}
                      </div>
                   )}
                </div>
             </div>
          ))}

          {/* Page Footer Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-12 pb-24 border-t border-slate-900">
             <button 
               disabled={activePageIndex === 0}
               onClick={() => setActivePageIndex(prev => prev - 1)}
               className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-20 transition-all font-black uppercase tracking-widest text-[10px]"
             >
                <ChevronLeft className="w-4 h-4" /> Previous Phase
             </button>
             <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {pages.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      i === activePageIndex ? "bg-indigo-500 w-6" : "bg-slate-800"
                    )} 
                  />
                ))}
             </div>
             <button 
               disabled={activePageIndex === pages.length - 1}
               onClick={() => setActivePageIndex(prev => prev + 1)}
               className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-20 transition-all font-black uppercase tracking-widest text-[10px]"
             >
                Next Phase <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        </div>
      </div>

      {/* ── FOOTER BAR ── */}
      <div className="h-12 bg-[#0f1117] border-t border-slate-800 flex items-center justify-center z-10 px-4 text-center truncate">
         <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] truncate w-full">
            {activePage.footer_text}
         </p>
      </div>

      {/* ── ANNOTATION VIEW MODAL ── */}
      {viewingAnnotationsId && (() => {
        const q = activePage.questions.find(quest => quest.id === viewingAnnotationsId);
        if (!q) return null;
        
        const ans = answers[q.id];
        let ansText = ans?.answer_text;
        if (!ansText && ans?.answer_json) {
           ansText = Array.isArray(ans.answer_json) ? ans.answer_json.join(', ') : JSON.stringify(ans.answer_json);
        }

        return (
          <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col animate-in fade-in duration-300">
             <div className="h-20 bg-[#0f1117] border-b border-white/5 px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <button onClick={() => setViewingAnnotationsId(null)} className="p-2 text-slate-400 hover:text-white transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                   </button>
                   <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Visual Assessment Layer</p>
                      <h2 className="text-sm font-black text-white uppercase tracking-widest">Question {activePage.questions.findIndex(quest => quest.id === viewingAnnotationsId) + 1} Annotations</h2>
                   </div>
                </div>
                <button 
                  onClick={() => setViewingAnnotationsId(null)}
                  className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Close Engine
                </button>
             </div>
             <div className="flex-1 overflow-hidden">
                <PremiumAnnotationEngine 
                  initialAnnotations={markings[viewingAnnotationsId]?.annotation_data || []}
                  onSave={() => {}}
                  readOnly={true}
                >
                   <div className="space-y-12 max-w-4xl mx-auto py-12 px-8">
                     <div className="p-8 bg-slate-50 border border-slate-200 rounded-3xl">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Question Blueprint</h3>
                        <p className="text-2xl font-black text-slate-900 leading-tight">{q.question_text}</p>
                     </div>

                     <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-3xl">
                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Student Response</h3>
                        <p className="text-xl font-bold text-indigo-900 whitespace-pre-wrap">{ansText || 'No digital footprint found'}</p>
                     </div>
                     
                     {/* Safe space for annotations */}
                     <div className="h-48" />
                   </div>
                </PremiumAnnotationEngine>
             </div>
          </div>
        );
      })()}

      {/* ── PRE-SUBMISSION REVIEW MODAL ── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col p-4 sm:p-8 animate-in fade-in duration-300 overflow-y-auto w-full h-[100dvh]">
           <div className="max-w-2xl w-full mx-auto bg-[#0f1117] border border-slate-800 rounded-3xl p-8 my-auto shadow-2xl mt-[10vh]">
              <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2 text-center">Submission Review</h2>
              <p className="text-slate-400 text-sm text-center mb-8">Please review your worksheet progress before finalizing.</p>
              
              <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
                 {pages.map((p) => {
                   const qs = p.questions.filter(q => q.question_type !== 'content_block');
                   if (qs.length === 0) return null;
                   
                   const answeredCount = qs.filter(q => answers[q.id]?.is_answered).length;
                   const allAnswered = answeredCount === qs.length;
                   
                   return (
                     <div key={p.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                           <p className="text-white font-bold text-sm">Page {p.page_number}: {p.header_title}</p>
                           <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{answeredCount} of {qs.length} Answered</p>
                        </div>
                        {allAnswered ? (
                           <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black uppercase w-fit self-end sm:self-auto border border-emerald-500/20"><CheckCircle2 className="w-3 h-3 inline mr-1" /> Complete</div>
                        ) : (
                           <div className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black uppercase w-fit self-end sm:self-auto border border-amber-500/20"><AlertCircle className="w-3 h-3 inline mr-1" /> Partial</div>
                        )}
                     </div>
                   );
                 })}
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-slate-800">
                 <button 
                   onClick={() => setShowReviewModal(false)}
                   className="w-full sm:flex-1 py-4 bg-slate-800 border border-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs hover:bg-slate-700 transition-colors"
                 >
                    Return to Draft
                 </button>
                 <button 
                   onClick={() => {
                     setShowReviewModal(false);
                     submitWorksheet();
                   }}
                   disabled={submitting}
                   className="w-full sm:flex-1 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all shadow-lg flex items-center justify-center gap-2"
                 >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Confirm & Submit
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
